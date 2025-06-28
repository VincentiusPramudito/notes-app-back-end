require('dotenv').config();

const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const Inert = require('@hapi/inert');

// const NotesService = require('./services/inMemory/NotesServices');

// notes
const NotesService = require('./services/postgres/NotesServices');
const NotesValidator = require('./validator/notes');
const notes = require('./api/notes');

// users
const UsersService = require('./services/postgres/UsersServices');
const UsersValidator = require('./validator/users');
const users = require('./api/users');

// authentications
const AuthenticationsService = require('./services/postgres/AuthenticationsServices');
const AuthenticationsValidator = require('./validator/authentications');
const authentications = require('./api/authentications');
const TokenManager = require('./tokenize/TokenManager');

// collaborations
const CollaborationsService = require('./services/postgres/CollaborationsServices');
const CollaborationsValidator = require('./validator/collaborations');
const collaborations = require('./api/collaborations');

// Exports
const _exports = require('./api/exports');
const ProducerService = require('./services/rabbitmq/ProducerService');
const ExportsValidator = require('./validator/exports');

// Uploads
const uploads = require('./api/uploads');
// const StorageService = require('./services/storage/StorageService');
const StorageService = require('./services/S3/StorageService');
const UploadsValidator = require('./validator/uploads');

// cache
const CacheService = require('./services/redis/CacheService');

const ClientError = require('./exceptions/ClientError');

const init = async () => {
  const cacheService = new CacheService();
  const collaborationsService = new CollaborationsService(cacheService);
  const notesService = new NotesService(collaborationsService, cacheService);
  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService();
  // const storageService = new StorageService(path.resolve(__dirname, 'api/uploads/file/images'));
  const storageService = new StorageService();

  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
    routes: {
      cors: {
        origin: ['*']
      }
    }
  });

  // registrasi plugin external
  await server.register([
    {
      plugin: Jwt
    },
    {
      plugin: Inert,
    },
  ]);

  // mendefinisikan strategi authentication jwt
  server.auth.strategy('notesapp_jwt', 'jwt', {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id
      }
    })
  });

  await server.register(
    [
      {
        plugin: notes,
        options: {
          service: notesService,
          validator: NotesValidator
        },
      },
      {
        plugin: users,
        options: {
          service: usersService,
          validator: UsersValidator
        }
      },
      {
        plugin: authentications,
        options: {
          authenticationsService,
          usersService,
          tokenManager: TokenManager,
          validator: AuthenticationsValidator,
        },
      },
      {
        plugin: collaborations,
        options: {
          collaborationsService,
          notesService,
          validator: CollaborationsValidator
        }
      },
      {
        plugin: _exports,
        options: {
          service: ProducerService,
          validator: ExportsValidator
        }
      },
      {
        plugin: uploads,
        options: {
          service: storageService,
          validator: UploadsValidator
        }
      }
    ]
  );

  server.ext('onPreResponse', (request, h) => {
    // mendapatkan konteks response dari request
    const { response } = request;

    // penanganan client error secara internal.
    if (response instanceof ClientError) {
      const newResponse = h.response({
        status: 'fail',
        message: response.message,
      });
      newResponse.code(response.statusCode);
      return newResponse;
    }

    console.log(`${request.info.remoteAddress}: ${request.method.toUpperCase()} ${request.path} --> ${request.response.statusCode}`);
    return h.continue;
  });

  await server.start();
  console.log(`App Running on ${server.info.uri}`);
};

init();
