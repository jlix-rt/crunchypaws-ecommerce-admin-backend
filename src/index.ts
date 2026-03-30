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

if (env.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

if (env.httpLog) {
  const format = env.nodeEnv === 'production' ? 'common' : 'dev';
  app.use(morgan(format));
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

const api = express.Router();

api.post('/auth/login', authController.login);
api.post('/auth/register', authController.register);
api.get('/auth/verify-email', authController.verifyEmail);

const admin = [authMiddleware];
const adminOnly = [...admin, roleMiddleware('ADMIN')];
const catalog = [...admin, roleMiddleware('ADMIN', 'SELLER')];
const readStaff = [...admin, roleMiddleware('ADMIN', 'SELLER', 'COLLABORATOR')];
const ordersStaff = [...admin, roleMiddleware('ADMIN', 'SELLER')];

api.get('/users', adminOnly, userController.list);
api.post('/users', adminOnly, userController.create);
api.patch('/users/:id/role', adminOnly, userController.updateRole);
api.patch('/users/:id', adminOnly, userController.updateDetails);

api.get('/categories/tree', readStaff, categoryController.tree);
api.post('/categories', catalog, categoryController.create);
api.patch('/categories/:id', catalog, categoryController.update);
api.delete('/categories/:id', catalog, categoryController.remove);

api.get('/products', readStaff, productController.list);
api.post('/products', catalog, productController.create);
api.patch('/products/:id', catalog, productController.update);
api.delete('/products/:id', catalog, productController.remove);

api.post(
  '/products/:productId/images',
  catalog,
  uploadProduct.single('image'),
  productImageController.upload,
);
api.patch(
  '/products/:productId/images/:imageId',
  catalog,
  uploadProduct.single('image'),
  productImageController.replace,
);
api.delete(
  '/products/:productId/images/:imageId',
  catalog,
  productImageController.remove,
);

api.get('/orders', ordersStaff, orderAdminController.list);
api.post('/orders/repair-cod-statuses', ordersStaff, orderAdminController.repairCodStatuses);
api.post('/orders/:id/actions', ordersStaff, orderAdminController.applyAction);

api.get('/order-statuses', ordersStaff, orderStatusAdminController.listStatuses);
api.post('/order-statuses', ordersStaff, orderStatusAdminController.createStatus);
api.patch('/order-statuses/:id', ordersStaff, orderStatusAdminController.updateStatus);
api.delete('/order-statuses/:id', ordersStaff, orderStatusAdminController.deleteStatus);

api.get('/order-status-transitions', ordersStaff, orderStatusAdminController.listTransitions);
api.post('/order-status-transitions/clone', ordersStaff, orderStatusAdminController.cloneTransition);
api.post('/order-status-transitions', ordersStaff, orderStatusAdminController.createTransition);
api.patch('/order-status-transitions/:id', ordersStaff, orderStatusAdminController.updateTransition);
api.delete('/order-status-transitions/:id', ordersStaff, orderStatusAdminController.deleteTransition);

app.use('/api', api);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Admin API CrunchyPaws http://localhost:${env.port}`);
});
