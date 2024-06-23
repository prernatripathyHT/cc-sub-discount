const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const RECHARGE_API_KEY = 'sk_test_2x2_b69d7aa3fe6f2600f0375946b77f8eb00dd2bf034133a9bd9702efd3bb2b3400'
const MONGO_COLLECTION = 'webhook_payloads'

// MongoDB connection setup
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://prerna_trip:WlFtsjAxFDscXPT7@cc-sub-discount.ebgalzu.mongodb.net/counter-culture' , {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB connected at ${mongoose.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit process with failure
  }
};

// Connect to MongoDB
connectDB();

// Middleware
app.use(bodyParser.json());

// Root route handler
app.get('/', (req, res) => {
  res.send('Welcome to the webhook server!');
});

// Webhook route handler
app.post('/webhook', async (req, res) => {
  console.log('========= *** =========');
  console.log('Received webhook:', req.body);

  try {
        // Save the payload to MongoDB
        const savedPayload = await mongoose.connection.db.collection(`${MONGO_COLLECTION}`).insertOne(req.body);
        console.log('Webhook payload saved:', savedPayload);

        res.sendStatus(200); // Respond to the webhook request
    } catch (err) {
        console.error('Error saving webhook payload:', err);
        res.sendStatus(500); // Respond with an error status
    }

    
    //1. After the webhook details is received, check if the discount code 'TIERED_SUB_5' is used.
    if(req.body.charge.discount_codes[0].code === 'TIERED_SUB_5' ){
        console.log('This customer qualifies for Tiered discount')


        //2. if yes, get the subscription_id and charge_id. Maybe need to add some tags to the customer?
        let subscription_id = req.body.charge.line_items[0].subscription_id;
        let charge_id = req.body.charge.id;

        console.table({
            "subscription_id": subscription_id,
            "charge_id": charge_id
        });
    


        //3. Check how many charges have already occured
        const myHeaders = new Headers();
        myHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);

        const requestOptions = {
        method: "GET",
        headers: myHeaders
        };

        console.log('====== *** ======')
        console.log('Making a request to check the order count...')

        fetch(`https://api.rechargeapps.com/orders/count?subscription_id=${subscription_id}`, requestOptions)
        .then((response) => response.json())
        .then((result) => {
            const count = result.count;
            console.log('Order Count for this subscription so far is...', count)



            console.log('====== *** ======')
            console.log('Applying the discount code ...')

            let SUB_DISCOUNT_CODE = ''
            
            //4. Apply the subsequent discount based on the count
            switch (count) {
                case 1:
                  console.log('Count is 1');
                  SUB_DISCOUNT_CODE = 'CHARGE_OFF_20'
                  break;
                case 2:
                  console.log('Count is 2');
                  SUB_DISCOUNT_CODE = 'CHARGE_OFF_30'
                  break;
                case 3:
                  console.log('Count is 3');
                  SUB_DISCOUNT_CODE = 'CHARGE_OFF_40'
                  break;
                case 4:
                  console.log('Count is 4');
                  SUB_DISCOUNT_CODE = 'CHARGE_OFF_50'
                  break;
                default:
                  console.log('Count is out of range');
              }


              const discountHeader = new Headers();
              discountHeader.append("X-Recharge-Access-Token", "sk_test_2x2_b69d7aa3fe6f2600f0375946b77f8eb00dd2bf034133a9bd9702efd3bb2b3400");
              discountHeader.append("Content-Type", "application/json");
  
              const raw = JSON.stringify({
              "discount_code": SUB_DISCOUNT_CODE
              });
  
              const discountReqOptions = {
              method: "POST",
              headers: discountHeader,
              body: raw,
              redirect: "follow"
              };
  
              fetch(`https://api.rechargeapps.com/charges/${charge_id}/apply_discount`, discountReqOptions)
              .then((response) => response.text())
              .then((result) => {
                console.log(`Discount code ${SUB_DISCOUNT_CODE} applied for the number ${count + 1} charge`)
                console.log(result)
                })
              .catch((error) => console.error(error));
        })
        .catch((error) => console.error(error));

    }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
