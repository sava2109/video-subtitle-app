import { Router } from 'express';
import videoRoutes from './videoRoutes';
import subtitleRoutes from './subtitleRoutes';

const router = Router();

router.use('/videos', videoRoutes);
router.use('/subtitles', subtitleRoutes);

export const setupRoutes = (app: any) => {
    app.use('/api', router);
};

export default router;