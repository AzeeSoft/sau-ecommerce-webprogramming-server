import { Router, Request, Response, NextFunction } from 'express';
import { accountsController } from './accounts/accountsController';
import { authController } from './auth/authController';
import jwt from 'jsonwebtoken';
import serverConfig, { ServerMode } from '@/tools/serverConfig';
import { ApiTokenPayload } from '../tools/types/auth/index';
import authMiddlewares from '@/middlewares/authMiddlewares';
import { devUtils } from '@/tools/utils/devUtils';
import { helperUtils, StringDecoration } from '@/tools/utils/helperUtils';
import { vendorsController } from './vendors/vendorsController';
import { productsController } from './products/productsController';
import { apiMiddlewares } from '@/middlewares/apiMiddlewares';
import { cartController } from './cart/cartController';
import { CartData } from '@/models/Account';
import { cartMiddlewares } from '@/middlewares/cartMiddlewares';

export type ApiResponseData = {
    success: boolean;
    message: string;
    errorReport?: object;
} & { [key: string]: any };

export const apiController: Router = Router();

apiController.use(
    '/.well-known/acme-challenge/:challengeKey',
    (req: Request, res: Response, next: NextFunction) => {
        res.send(process.env.ACME_CHALLENGE_RESULT || '');
    }
);

apiController.use(apiMiddlewares.multipartPreprocessor);
apiController.use(initRoute, extractApiToken);
apiController.use(cartMiddlewares.initCartDataInRoute);

apiController.use('/auth', authController);
apiController.use('/accounts', accountsController);
apiController.use('/vendors', vendorsController);
apiController.use('/products', productsController);
apiController.use('/cart', cartController);

apiController.get('/dashboardData', getDashboardData);

function getDashboardData(req: Request, res: Response, next: NextFunction) {
    res.json({
        success: true,
        message: 'Dashboard data collected successfully',
        dashboardData: {
            tax: serverConfig.dashboard.checkout.taxRate,
            deliveryCharge: serverConfig.dashboard.checkout.deliveryCharge,
        },
    } as ApiResponseData);
}

/**
 * (Middleware)
 * Initializes the route data with the proper structure and dummy values
 */
function initRoute(req: Request, res: Response, next: NextFunction) {
    req.routeData = {
        accounts: {
            providedAccount: undefined,
        },
        products: {
            selectedProduct: undefined,
        },
        cartData: new CartData(),
    };

    next();
}

/**
 * (Middleware)
 * Extracts ApiToken from Authorization Header and puts the ApiTokenPayload on the request for further handlers to use.
 */
function extractApiToken(req: Request, res: Response, next: NextFunction) {
    req.apiTokenPayload = undefined;

    let apiToken;

    devUtils.log();

    // Try to extract apiToken from the http authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
        // The authHeader will be in this format: Bearer <token>
        const authHeaderWords = authHeader.split(' ');
        if (authHeaderWords.length >= 2) {
            apiToken = authHeaderWords[1];

            devUtils.log('Found api token in auth header');
        }
    }

    // Try to extract apiToken from the session
    if (!apiToken) {
        devUtils.log('Cannot find api token in auth header! Checking session instead...');

        if (req.session && req.session.apiToken) {
            apiToken = req.session.apiToken;
            devUtils.log('Found api token in session');
        } else {
            devUtils.log('Cannot find api token in session!');
        }
    }

    devUtils.log();

    if (apiToken) {
        jwt.verify(
            apiToken,
            serverConfig.auth.jwt.secret,
            serverConfig.auth.jwt.options,
            (err, decodedPayload) => {
                if (err) {
                    helperUtils.log(`Error during ApiToken Verification: ${err.stack}`);
                } else {
                    devUtils.log('Decoded API Token Payload:', StringDecoration.UNDERLINE);
                    devUtils.log(`${JSON.stringify(decodedPayload, null, 4)}\n`);
                    req.apiTokenPayload = decodedPayload as ApiTokenPayload;
                }
                next();
            }
        );
    } else {
        next();
    }
}
