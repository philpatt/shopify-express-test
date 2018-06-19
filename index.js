const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce');
const querystring = require('querystring');
const request = require('request-promise')
const ShopifyToken = require('shopify-token')
const apiKey = process.env.SHOPIFY_API_KEY
const apiSecret = process.env.SHOPIFY_API_SECRET
const scope = 'write_products';
const forwardingAddress = 'https://shopify-express.herokuapp.com' //replace this with your HTTPS forwarding address

const shopifyToken = new ShopifyToken({
    sharedSecret: apiSecret,
    redirectUri: forwardingAddress + '/shopify/callback',
    apiKey: apiKey
})
app.get('/',(req,res) => {
    res.send('Hello World!')
})
app.get('/shopify', (req,res)=>{
    const shop = req.query.shop
    if(shop){
        const shopRegex = /^([\w-]+)\.myshopify\.com/i
        const shopName = shopRegex.exec(shop)[1]
        const state = shopifyToken.generateNonce();
        const url = shopifyToken.generateAuthUrl(shopName, scope, state)
        console.log('initial state:',state)
        const redirectUri = forwardingAddress + '/shopify/callback';
        const installUrl = 'https://' + shop + '/admin/oauth/authorize?client_id=' + apiKey + '&scope=' + scope + '&state' + state + '&redirect_uri=' + redirectUri;

        res.cookie('state',state);
        res.redirect(url);
    }else{
        return res.status(400).send('Missing shop paramater')
    }
})
app.get('/shopify/callback', (req,res) => {
    const { shop, hmac, code, state } = req.query
    const stateCookie = cookie.parse(req.headers.cookie).state;
    if(state !== stateCookie){
        return res.status(403).send('Request origin cannot be verified')
    }

    if(!shop || !hmac || !code) {
        res.status(400).send('Require parameters missing');
    } else if (shop && hmac && code) {
        const map = Object.assign({}, req.query);
        delete map['hmac'];
        const message = querystring.stringify(map);
        const generateHash = crypto
            .createHmac('sha256', apiSecret)
            .update(message)
            .digest('hex');
        
        if(generateHash !== hmac){
            return res.status(400).send('HMAC validation failed!');
        }

        const accessTokenRequestUrl = 'https://' + shop + '/admin/oauth/access_token';
        const accessTokenPayload = {
            client_id: apiKey,
            client_secret: apiSecret,
            code
        };

        request.post(accessTokenRequestUrl, {json: accessTokenPayload})
        .then((accessTokenResponse) => {
            const accessToken = accessTokenResponse.access_token;

            const apiRequestUrl = 'https://' + shop + '/admin/products.json';

            const apiRequestHeader = {
                'X-Shopfify-Access-Token': accessToken
            };

            request.get(apiRequestUrl, { headers: apiRequestHeader})
            .then((apiResponse) => {
                res.end(apiResponse);
            })
            .catch((error) => {
                res.status(error.statustCode).send(error.error.error_description);
            });
        })
        .catch((error) => {
            res.status(error.statusCode).send(error.error.error_description);
        });

    } else {
        res.status(400).send('required params missing')
    }
})
app.listen(process.env.PORT || 3000, () => {
    console.log('Example app listening on port 3000!');
});