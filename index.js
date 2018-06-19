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
    console.log(shop)
    if(shop){
        const shopRegex = /^([\w-]+)\.myshopify\.com/i
        const shopName = shopRegex.exec(shop)[1]
        console.log(shop, shopName)
        const state = shopifyToken.generateNonce();
        const url = shopifyToken.generateAuthUrl(shopName, scopes, state)
        console.log('initial state:',state)
        const redirectUri = forwardingAddress + '/shopify/callback';
        const installUrl = 'https://' + shop + '/admin/oauth/authorize?client_id=' + apiKey + '&scope=' + scope + '&state' + state + '&redirect_uri=' + redirectUri;

        res.cookie('state',state);
        res.redirect(url);
    }else{
        return res.status(400).send('Missing shop paramater')
    }
})
app.get('/shopify/callback', async (req,res) => {
    const { shop, hmac, code, state } = req.query
    const stateCookie = cookie.parse(req.headers.cookie).state;
    console.log('stateCookie:',stateCookie)
    console.log('state:', state)

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
        const accessToken = await shopifyToken.getAccessToken(shop,code)
        const shopRequestUrl = 'https://' + shop + '/admin/shop.json';
        const shopRequestHeaders = {'X-Shopify-Access-Token': accessToken}
        try {
            const shopResponse = await request.tget(shopRequestUrl, { headers: shopRequestHeaders })
            res.status(200).end(shopResponse)
        } catch(error){
            res.status(error.statusCode).send(error.error_description)
        }
    }
})
app.listen(process.env.PORT || 3000, () => {
    console.log('Example app listening on port 3000!');
});