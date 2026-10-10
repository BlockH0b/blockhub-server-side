// confiq/passport/index.js
const passport = require('passport');

// Register both strategies
require('./userPassword'); // uses the shared `passport`
require('./passport'); // also uses the same shared `passport`

module.exports = passport;