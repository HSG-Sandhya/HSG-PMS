import swaggerJsdoc from 'swagger-jsdoc';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * OpenAPI spec assembled from `@openapi` JSDoc blocks in the route files.
 * Bearer (JWT) auth is the default security scheme — matching the REST API.
 */
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hotel Sandhya Grand API',
      version: '1.0.0',
      description:
        'Property management system API — rooms, bookings, restaurant, housekeeping, accounting, and report exports.',
    },
    servers: [{ url: '/', description: 'Current host' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication' },
      { name: 'Bookings', description: 'Room bookings & check-in/out' },
      { name: 'Exports', description: 'Excel (.xlsx) report exports' },
    ],
  },
  // Absolute glob so the scan works regardless of process cwd.
  apis: [join(__dirname, '../routes/*.js')],
});

export default swaggerSpec;
