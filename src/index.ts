import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/error.js';
import { authMiddleware, roleMiddleware } from './middlewares/auth.middleware.js';
import * as authController from './controllers/auth.controller.js';
import * as userController from './controllers/user.controller.js';
import * as categoryController from './controllers/category.controller.js';
import * as productController from './controllers/product.controller.js';
import * as productImageController from './controllers/product-image.controller.js';
import * as orderAdminController from './controllers/order.admin.controller.js';
import * as orderStatusAdminController from './controllers/order-status.admin.controller.js';

const productsDir = path.join(env.storagePath, 'products');
fs.mkdirSync(productsDir, { recursive: true });

const uploadProduct = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, productsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_r, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype));
  },
});

const app = express();

if (env.nodeEnv !== 'production') {
  app.use(morgan('dev'));
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/auth/login', authController.login);
app.post('/auth/register', authController.register);
app.get('/auth/verify-email', authController.verifyEmail);

const admin = [authMiddleware];
const adminOnly = [...admin, roleMiddleware('ADMIN')];
const catalog = [...admin, roleMiddleware('ADMIN', 'SELLER')];
const readStaff = [...admin, roleMiddleware('ADMIN', 'SELLER', 'COLLABORATOR')];
const ordersStaff = [...admin, roleMiddleware('ADMIN', 'SELLER')];

app.get('/users', adminOnly, userController.list);
app.post('/users', adminOnly, userController.create);
app.patch('/users/:id/role', adminOnly, userController.updateRole);
app.patch('/users/:id', adminOnly, userController.updateDetails);

app.get('/categories/tree', readStaff, categoryController.tree);
app.post('/categories', catalog, categoryController.create);
app.patch('/categories/:id', catalog, categoryController.update);
app.delete('/categories/:id', catalog, categoryController.remove);

app.get('/products', readStaff, productController.list);
app.post('/products', catalog, productController.create);
app.patch('/products/:id', catalog, productController.update);
app.delete('/products/:id', catalog, productController.remove);

app.post(
  '/products/:productId/images',
  catalog,
  uploadProduct.single('image'),
  productImageController.upload,
);
app.patch(
  '/products/:productId/images/:imageId',
  catalog,
  uploadProduct.single('image'),
  productImageController.replace,
);
app.delete(
  '/products/:productId/images/:imageId',
  catalog,
  productImageController.remove,
);

app.get('/orders', ordersStaff, orderAdminController.list);
app.post('/orders/repair-cod-statuses', ordersStaff, orderAdminController.repairCodStatuses);
app.post('/orders/:id/actions', ordersStaff, orderAdminController.applyAction);

app.get('/order-statuses', ordersStaff, orderStatusAdminController.listStatuses);
app.post('/order-statuses', ordersStaff, orderStatusAdminController.createStatus);
app.patch('/order-statuses/:id', ordersStaff, orderStatusAdminController.updateStatus);
app.delete('/order-statuses/:id', ordersStaff, orderStatusAdminController.deleteStatus);

app.get('/order-status-transitions', ordersStaff, orderStatusAdminController.listTransitions);
app.post('/order-status-transitions/clone', ordersStaff, orderStatusAdminController.cloneTransition);
app.post('/order-status-transitions', ordersStaff, orderStatusAdminController.createTransition);
app.patch('/order-status-transitions/:id', ordersStaff, orderStatusAdminController.updateTransition);
app.delete('/order-status-transitions/:id', ordersStaff, orderStatusAdminController.deleteTransition);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Admin API CrunchyPaws http://localhost:${env.port}`);
});
