const Hapi = require('@hapi/hapi');
// const routes = require('./routes');
const notes = require('./api/notes');
const NotesService = require('./services/inMemory/NotesServices');

const init = async () => {
  const notesService = new NotesService();

  const server = Hapi.server({
    port: 5000,
    host: process.env.NODE_ENV !== 'production' ? 'localhost' : '0.0.0.0',
    routes: {
      cors: {
        origin: ['*']
      }
    }
  });

  // server.route(routes);

  // ==> register plugin
  await server.register({
    plugin: notes,
    options: {
      service: notesService,
    },
  });

  await server.start();
  console.log(`App Running on ${server.info.uri}`);
};

init();
