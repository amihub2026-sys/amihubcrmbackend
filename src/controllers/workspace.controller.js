import { bootstrap } from "../services/workspace.service.js";
export function createController() {
  return {
    async bootstrap(req, res) {
      res.json(await bootstrap(req.user));
    },
  };
}
