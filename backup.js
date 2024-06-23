const express = require('express');
const bodyParser = require('body-parser');
// const fs = require('fs-extra'); // Import the fs-extra module
const mongoose = require('mongoose');



const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Root route handler
app.get('/', (req, res) => {
    res.send('Welcome to the webhook server!');
});

app.post('/webhook', async (req, res) => {
    console.log('========= *** =========');
    console.log('Received webhook:', req.body);

    // Get the subscription_id and charge_id value
    let subscription_id = req.body.charge.line_items[0].subscription_id;
    let charge_id = req.body.charge.id;

    console.table({
        "subscription_id": subscription_id,
        "charge_id": charge_id
    });

    //1. After the webhook details is received, check if the discount code 'TIERED_SUB_5' is used.
    //2. if yes, get the subscription_id and charge_id. Maybe need to add some tags to the customer?
    //3. Check how many charges have already occured
    //4. Apply the subsequent discount based on that    


    // console.log(req.body.charge.discount_codes[0].code)

    if(req.body.charge.discount_codes[0].code === 'TIERED_SUB_5' ){
        console.log('This customer qualifies for Tiered discount')
    }

    try {
        // Read existing data from charge-data.json
        let chargeData = [];
        if (await fs.pathExists('charge-data.json')) {
            const data = await fs.readJson('charge-data.json');
            chargeData = Array.isArray(data) ? data : [];
        }

        // Add new entry to the charge data
        chargeData.push({ subscription_id, charge_id });

        // Write updated data back to charge-data.json
        await fs.writeJson('charge-data.json', chargeData, { spaces: 2 });

        res.sendStatus(200);
    } catch (err) {
        console.error('Error handling charge-data.json:', err);
        if (!res.headersSent) {
            res.sendStatus(500);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
