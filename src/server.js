require('dotenv').config();

const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');

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

const ClientError = require('./exceptions/ClientError');

const init = async () => {
  const notesService = new NotesService();
  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService();

  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
    routes: {
      cors: {
        origin: ['*']
      }
    }
  });

  // registrasi plugiin external
  await server.register([
    {
      plugin: Jwt
    }
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

    return h.continue;
  });

  await server.start();
  console.log(`App Running on ${server.info.uri}`);
};

init();
