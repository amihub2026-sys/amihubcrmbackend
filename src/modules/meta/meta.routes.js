import { Router } from 'express';
import * as service from './meta.service.js';

export function createRouter(config) {
  const router = Router();


  // =====================================================
  // BOOTSTRAP
  // =====================================================

  router.get(
    '/bootstrap',
    async (req, res) =>
      res.json(
        await service.bootstrap(
          req.user,
          config
        )
      )
  );


  // =====================================================
  // DASHBOARD / TRACKING
  // =====================================================

  router.get(
    '/dashboard',
    async (req, res) =>
      res.json(
        await service.dashboard(
          req.user,
          req.query,
          config
        )
      )
  );


  // =====================================================
  // LINK META AD ACCOUNT
  // =====================================================

  router.post(
    '/accounts/link',
    async (req, res) =>
      res.status(201).json({
        account:
          await service.linkAccount(
            req.user,
            req.body,
            config
          ),
      })
  );


  // =====================================================
  // ENABLE / DISABLE ACCOUNT
  // =====================================================

  router.patch(
    '/accounts/:id',
    async (req, res) =>
      res.json({
        account:
          await service.setEnabled(
            req.user,
            req.params.id,
            req.body?.enabled,
            config
          ),
      })
  );


  // =====================================================
  // SYNC ACCOUNT
  // =====================================================

  router.post(
    '/accounts/:id/sync',
    async (req, res) =>
      res.status(202).json({
        account:
          await service.queueSync(
            req.user,
            req.params.id,
            req.body,
            config
          ),
      })
  );


  // =====================================================
  // ACCOUNT DETAILS
  // =====================================================

  router.get(
    '/accounts/:id/detail',
    async (req, res) =>
      res.json(
        await service.detail(
          req.user,
          req.params.id,
          req.query
        )
      )
  );


  // =====================================================
  // CREATE META CAMPAIGN
  //
  // POST:
  // /api/meta/accounts/:id/campaigns
  //
  // Creates Meta campaign as PAUSED.
  // =====================================================

  router.post(
    '/accounts/:id/campaigns',
    async (req, res) =>
      res.status(201).json({
        campaign:
          await service.createCampaign(
            req.user,
            req.params.id,
            req.body,
            config
          ),
      })
  );


  // =====================================================
  // CREATE META AD SET / AUDIENCE
  //
  // POST:
  // /api/meta/accounts/:id/adsets
  //
  // Body contains:
  //
  // campaignId
  // name
  // dailyBudget
  // ageMin
  // ageMax
  // gender
  // locationKey
  // startTime
  // endTime
  // optimizationGoal
  // billingEvent
  //
  // Ad Set is always created as PAUSED.
  // =====================================================

  router.post(
    '/accounts/:id/adsets',
    async (req, res) =>
      res.status(201).json({
        adSet:
          await service.createAdSet(
            req.user,
            req.params.id,
            req.body,
            config
          ),
      })
  );
// =====================================================
// SEARCH META TARGET LOCATIONS
//
// GET:
// /api/meta/accounts/:id/locations/search?q=Madurai
// =====================================================

router.get(
  '/accounts/:id/locations/search',
  async (req, res) =>
    res.json(
      await service.searchLocations(
        req.user,
        req.params.id,
        req.query,
        config
      )
    )
);
// =====================================================
// GET META CREATIVE ASSETS
//
// GET:
// /api/meta/accounts/:id/creative-assets
//
// Returns:
// - Facebook Pages
// - Instagram Accounts
// =====================================================

router.get(
  '/accounts/:id/creative-assets',
  async (req, res) =>
    res.json(
      await service.creativeAssets(
        req.user,
        req.params.id,
        config
      )
    )
);
// =====================================================
// CREATE META IMAGE AD
//
// POST:
// /api/meta/accounts/:id/ads
//
// Creates final Meta Ad as PAUSED.
// =====================================================

router.post(
  '/accounts/:id/ads',
  async (req, res) =>
    res.status(201).json({
      ad:
        await service.createImageAd(
          req.user,
          req.params.id,
          req.body,
          config
        ),
    })
);
  return router;
}