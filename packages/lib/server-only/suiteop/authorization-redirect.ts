import { redirectDocument } from 'react-router';

export const createSuiteOpAuthorizationRedirect = (redirectUrl: URL) => redirectDocument(redirectUrl.toString());
