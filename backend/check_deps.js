const mongoose = require('mongoose');
const Deployment = require('./models/Deployment');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const deps = await Deployment.find({ userId: '69491ecca5fda0f50c83b31b' });
        console.log(JSON.stringify(deps, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
