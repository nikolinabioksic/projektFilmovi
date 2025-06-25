require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const app = express();
const port = process.env.PORT || 3000;

// Middleware za JSON body parsiranje
app.use(express.json());

// Pool konekcija na MySQL bazu
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Swagger/OpenAPI konfiguracija
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Filmovi API',
    version: '1.0.0',
    description: 'CRUD REST API za popis filmova, MySQL/phpMyAdmin, uz Swagger dokumentaciju',
  },
  servers: [
    { url: `http://localhost:${port}`, description: 'Lokalni server' }
  ]
};
const swaggerOptions = {
  swaggerDefinition,
  apis: ['./index.js']  
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.send('✅ Server je živ na portu ' + port);
});

// Definicija OpenAPI sheme za filmove
/**
 * @openapi
 * components:
 *   schemas:
 *     Movie:
 *       type: object
 *       required:
 *         - naslov
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         naslov:
 *           type: string
 *           example: "Inception"
 *         godina:
 *           type: integer
 *           example: 2010
 *         zanr:
 *           type: string
 *           example: "Sci-Fi"
 *         created_at:
 *           type: string
 *           format: date-time
 */

// CRUD rute za entitet "filmovi"
/**
 * @openapi
 * /filmovi:
 *   get:
 *     summary: Dohvati sve filmove
 *     responses:
 *       200:
 *         description: Lista filmova
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Movie'
 */
app.get('/filmovi', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM filmovi');
  res.json(rows);
});

/**
 * @openapi
 * /filmovi/{id}:
 *   get:
 *     summary: Dohvati film po ID-u
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Jedan film
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Movie'
 *       404:
 *         description: Film nije pronađen
 */
app.get('/filmovi/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM filmovi WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Film nije pronađen' });
  res.json(rows[0]);
});

/**
 * @openapi
 * /filmovi:
 *   post:
 *     summary: Dodaj novi film
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             required: [naslov]
 *             properties:
 *               naslov:
 *                 type: string
 *               godina:
 *                 type: integer
 *               zanr:
 *                 type: string
 *     responses:
 *       201:
 *         description: Film je dodan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Movie'
 */
app.post('/filmovi', async (req, res) => {
  const { naslov, godina, zanr } = req.body;
  const [result] = await pool.query(
    'INSERT INTO filmovi (naslov, godina, zanr) VALUES (?, ?, ?)',
    [naslov, godina, zanr]
  );
  const [rows] = await pool.query('SELECT * FROM filmovi WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

/**
 * @openapi
 * /filmovi/{id}:
 *   put:
 *     summary: Ažuriraj film
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               naslov:
 *                 type: string
 *               godina:
 *                 type: integer
 *               zanr:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ažurirani film
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Movie'
 *       404:
 *         description: Film nije pronađen
 */
app.put('/filmovi/:id', async (req, res) => {
  const { naslov, godina, zanr } = req.body;
  const [result] = await pool.query(
    `UPDATE filmovi SET naslov = COALESCE(?, naslov), godina = COALESCE(?, godina), zanr = COALESCE(?, zanr) WHERE id = ?`,
    [naslov, godina, zanr, req.params.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ message: 'Film nije pronađen' });
  const [rows] = await pool.query('SELECT * FROM filmovi WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

/**
 * @openapi
 * /filmovi/{id}:
 *   delete:
 *     summary: Obriši film
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       204:
 *         description: Film obrisan
 *       404:
 *         description: Film nije pronađen
 */
app.delete('/filmovi/:id', async (req, res) => {
  const [result] = await pool.query('DELETE FROM filmovi WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ message: 'Film nije pronađen' });
  res.status(204).send();
});

// Pokretanje servera
app.listen(port, () => {
  console.log(`Server pokrenut na http://localhost:${port}`);
  console.log(`Swagger UI na http://localhost:${port}/api-docs`);
});

