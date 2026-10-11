import app from './app.js';
import { warmGoogleIdentityService } from './services/authService.js';
import { connectDatabase } from './services/database.js';

const port = Number(process.env.PORT) || 5000;
try {
  await connectDatabase();
  const server = app.listen(port);

  server.once('listening', () => {
    console.log(`PlaceX API is listening on http://localhost:${port}`);
    void warmGoogleIdentityService();
  });

  server.once('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
    } else {
      console.error(`Unable to start PlaceX API: ${error.message}`);
    }
    process.exitCode = 1;
  });
} catch (error) {
  console.error(`Unable to connect to MongoDB: ${error.message}`);
  process.exitCode = 1;
}
