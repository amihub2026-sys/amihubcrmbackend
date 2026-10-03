import { Router } from 'express';
import * as service from './meta.service.js';

export function createRouter(config) {
  const router = Router();

  router.get('/bootstrap', async (req, res) =>
    res.json(
      await service.bootstrap(
        req.user,
        config
      )
    )
  );

  router.get('/dashboard', async (req, res) =>
    res.json(
      await service.dashboard(
        req.user,
        req.query,
        config
      )
    )
  );

  router.post('/accounts/link', async (req, res) =>
    res.status(201).json({
      account: await service.linkAccount(
        req.user,
        req.body,
        config
      ),
    })
  );

  router.patch('/accounts/:id', async (req, res) =>
    res.json({
      account: await service.setEnabled(
        req.user,
        req.params.id,
        req.body?.enabled,
        config
      ),
    })
  );

  router.post('/accounts/:id/sync', async (req, res) =>
    res.status(202).json({
      account: await service.queueSync(
        req.user,
        req.params.id,
        req.body,
        config
      ),
    })
  );

  router.get('/accounts/:id/detail', async (req, res) =>
    res.json(
      await service.detail(
        req.user,
        req.params.id,
        req.query
      )
    )
  );

  return router;
}