# CrunchyPaws Admin API

Misma base PostgreSQL que la tienda. Tras cambiar `crunchypaws-ecommerce-backend/prisma/schema.prisma`, copia el archivo a `prisma/schema.prisma` aquí y ejecuta `npm run db:generate`.

```bash
cp ../crunchypaws-ecommerce-backend/prisma/schema.prisma prisma/schema.prisma
npm run db:generate
npm run dev
```

Variables: ver `.env.example`.
