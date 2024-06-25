const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const RECHARGE_API_KEY = 'sk_test_2x2_b69d7aa3fe6f2600f0375946b77f8eb00dd2bf034133a9bd9702efd3bb2b3400'
const MONGO_COLLECTION = 'webhook_payloads'
// const MONGO_COLLECTION = 'webhooks'

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
  //console.log('Received webhook:', req.body);

  try {
        // Save the payload to MongoDB
        const savedPayload = await mongoose.connection.db.collection(`${MONGO_COLLECTION}`).insertOne(req.body);
        console.log('Webhook payload saved:', savedPayload);

        res.sendStatus(200); // Respond to the webhook request
    } catch (err) {
        console.error('Error saving webhook payload:', err);
        res.sendStatus(500); // Respond with an error status
    }

    //0. Check if the type is CHECKOUT or RECURRING
    if(req.body.charge.type == 'CHECKOUT'){
      console.log('----- This charge is of type CHECKOUT -----')

      //1. After the webhook details is received, check if the discount code 'TIERED_SUB_5' is used.
      if(req.body.charge.discount_codes.length > 0){
        if(req.body.charge.discount_codes[0].code === 'TIERED_SUB_5' ){
          console.log('This customer qualifies for Tiered discount, adding properties to subscription object...')

          //2. if yes, get the subscription_id and charge_id. Maybe need to add some tags to the customer?
          let subscription_id = req.body.charge.line_items[0].subscription_id;
          let charge_id = req.body.charge.id;

          console.table({
              "subscription_id": subscription_id,
              "charge_id": charge_id
          });


          //3. Add the properties to the subscription 
          const subscriptionHeaders = new Headers();
          subscriptionHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);
          subscriptionHeaders.append("Content-Type", "application/json");

          const raw = JSON.stringify({
            "properties": [
              {
                "name": "qualifies for tiered discount",
                "value": true
              }
            ]
          });

          const requestOptions = {
            method: "PUT",
            headers: subscriptionHeaders,
            body: raw
          };

          fetch(`https://api.rechargeapps.com/subscriptions/${subscription_id}`, requestOptions)
            .then((response) => response.text())
            .then((result) => {
              console.log('added properties to the subscription object: ', result)

            })
            .catch((error) => console.error(error));

        }
      }
    }
    else if(req.body.charge.type == 'RECURRING'){
      console.log('----- This charge is of type RECURRING -----')

      let subscription_id = req.body.charge.line_items[0].subscription_id;
      let charge_id = req.body.charge.id;


      //Add a delay of 1000ms before processing the RECURRING request
      setTimeout(() => {
        
      console.log('After 1000ms delay, process the RECURRING request')

        //1. Check the properties of the subscription and see if it qualifies for a discount
        const subPropertyHeaders = new Headers();
        subPropertyHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);

        const requestOptions = {
          method: "GET",
          headers: subPropertyHeaders
        };

        fetch(`https://api.rechargeapps.com/subscriptions/${subscription_id}`, requestOptions)
          .then((response) => response.json())
          .then((result) => {
            const subscription = result.subscription;
            if (subscription) {
              const property = subscription.properties.find(prop => prop.name === 'qualifies for tiered discount');
              if (property) {
                console.log("Property found: 'qualifies for tiered discount':", property.value);

                if(property.value == true){
                  console.log('---** This RECURRING ORDER qualifies for discount **---')


                  //3. Check how many charges have already occured
                  const chargeCountHeaders = new Headers();
                  chargeCountHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);

                  const requestOptions = {
                  method: "GET",
                  headers: chargeCountHeaders
                  };

                  console.log('====== *** ======')
                  console.log('Making a request to check the charge count...')

                  fetch(`https://api.rechargeapps.com/charges/count?subscription_id=${subscription_id}`, requestOptions)
                  .then((response) => response.json())
                  .then((result) => {
                      const count = result.count;
                      console.log('Charge Count for this subscription so far is...', count)



                      console.log('====== *** ======')
                      console.log('Applying the discount code ...')

                    
                      


                      //4. Apply the subsequent discount based on the count
                      let SUB_DISCOUNT_CODE = ''
                      switch (count) {
                          case 2:
                          console.log('Count is 2');
                          SUB_DISCOUNT_CODE = 'CHARGE_OFF_20'
                          break;
                          case 3:
                          console.log('Count is 3');
                          SUB_DISCOUNT_CODE = 'CHARGE_OFF_30'
                          break;
                          case 4:
                          console.log('Count is 4');
                          SUB_DISCOUNT_CODE = 'CHARGE_OFF_40'
                          break;
                          case 5:
                          console.log('Count is 5');
                          SUB_DISCOUNT_CODE = 'CHARGE_OFF_50'
                          break;
                          default:
                          console.log('Count is out of range');
                      }





                      const discountHeader = new Headers();
                      discountHeader.append("X-Recharge-Access-Token", RECHARGE_API_KEY);
                      discountHeader.append("Content-Type", "application/json");
          
                      const raw = JSON.stringify({
                        "discount_code": SUB_DISCOUNT_CODE
                      });
          
                      const discountReqOptions = {
                      method: "POST",
                      headers: discountHeader,
                      body: raw
                      };
          
                      fetch(`https://api.rechargeapps.com/charges/${charge_id}/apply_discount`, discountReqOptions)
                      .then((response) => response.text())
                      .then((result) => {
                          console.log(`Discount code ${SUB_DISCOUNT_CODE} applied for the charge number ${count} with ID ${charge_id}`)
                          //console.log(result)
                          })
                      .catch((error) => console.error(error));
                  })
                  .catch((error) => console.error(error));




                }
              } else {
                console.log("Property not found: 'qualifies for tiered discount '", "this RECURRING ORDER does not qualify for discount");
              }
            }

          })
          .catch((error) => console.error(error));

      }, 1000); 



    }



});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
