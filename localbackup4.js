const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const RECHARGE_API_KEY = 'sk_test_2x2_b69d7aa3fe6f2600f0375946b77f8eb00dd2bf034133a9bd9702efd3bb2b3400'
// const MONGO_COLLECTION = 'sub_payloads_1'
const MONGO_COLLECTION = 'webhooks'

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



// Webhook - subscription/created
app.post('/subscription', async (req, res) => {
  console.log('========= *** =========');
  console.log('---- Received subscription/created webhook ----');
  console.log('========= *** =========');

  try {
    // Save the payload to MongoDB
    const savedPayload = await mongoose.connection.db.collection(`${MONGO_COLLECTION}`).insertOne(req.body);
    console.log('Webhook payload saved:', savedPayload);
    res.sendStatus(200); // Respond to the webhook request
  } catch (err) {
    console.error('Error saving webhook payload:', err);
    res.sendStatus(500); // Respond with an error status
  }

  let subscription_id = req.body.subscription.id;
  let product_title = req.body.subscription.product_title;

  console.table({
    "subscription_id": subscription_id,
    "product": product_title
  });

  console.log('Subscription ID for product ', product_title , 'is ===>', subscription_id);

  try {
    // Get all charges for this subscription ID
    const chargeHeaders = new Headers();
    chargeHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);

    const requestOptions = {
      method: "GET",
      headers: chargeHeaders
    };

    const response = await fetch(`https://api.rechargeapps.com/charges?subscription_id=${subscription_id}`, requestOptions);
    const chargeRes = await response.json();

    console.log(`****** RETRIEVED CHARGES FOR THE SUBSCRIPTION with subscription ID: ${subscription_id} ******`);
    //console.log(chargeRes);

  

    // Separate the charges into CHECKOUT and RECURRING arrays
    let checkoutCharges = null;
    let recurringCharges = null;

    chargeRes.charges.forEach((charge) => {
      if (charge.type === 'CHECKOUT') {
        checkoutCharges = charge;
      } else if (charge.type === 'RECURRING') {
        recurringCharges = charge;
      }
    });


    
    console.log(`checkoutCharges for ${subscription_id} ${product_title} ===>`, checkoutCharges.discount_codes ? checkoutCharges.discount_codes : [], checkoutCharges.line_items.map((item) => item.title));
    console.log(`recurringCharges for ${subscription_id} ${product_title} ===>`, recurringCharges.discount_codes ? recurringCharges.discount_codes : [], recurringCharges.line_items.map((item) => item.title));


    let subQualifiesForDiscount = false;

    

    if (checkoutCharges) {
      console.log(`----- This charge is of type CHECKOUT (subscription/created) for ${product_title} -----`);

      if (checkoutCharges.discount_codes && checkoutCharges.discount_codes.length > 0 && checkoutCharges.discount_codes[0].code === 'TIERED_SUB_5') {
        console.log('------- This charge qualifies for TIERED DISCOUNT ------');
        console.log('adding properties to subscription object...');


        console.log('TODO: Check this for all line items not just one');


        //let subscription_id = checkoutCharges.line_items[0].subscription_id;
        let charge_id = checkoutCharges.id;

        subQualifiesForDiscount = true;

        console.table({
          "subscription_id": subscription_id,
          "charge_id": charge_id
        });

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

        await fetch(`https://api.rechargeapps.com/subscriptions/${subscription_id}`, requestOptions);
        console.log(`** Added properties to the Subscription object for ${product_title} **`);

        
      }
    }

    console.log(`${product_title} qualifies for discount  ====> ${subQualifiesForDiscount}`);
    // Processing of CHECKOUT charges is complete. Now starting to process RECURRING charges.
    console.log('----- Processing of CHECKOUT charges is complete. Starting to process RECURRING charges -----');


    if (recurringCharges) {
      console.log(`----- This charge is of type RECURRING (subscription/created) for ${product_title}  -----`);

      let subscription_id = recurringCharges.line_items[0].subscription_id;
      let charge_id = recurringCharges.id;

      if(subQualifiesForDiscount){
        console.log(`-- subQualifiesForDiscount: ${subQualifiesForDiscount}  ==> Adding 20% off to recurring charge for ${product_title} since this Subscription qualifies for a discount --`);

        const chargeCountHeaders = new Headers();
        chargeCountHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);

        const requestOptions = {
          method: "GET",
          headers: chargeCountHeaders
        };

        const response = await fetch(`https://api.rechargeapps.com/charges/count?subscription_id=${subscription_id}`, requestOptions);
        const result = await response.json();
        const count = result.count;
        console.log('Charge Count for this subscription so far is...', count);

        console.log('====== *** ======');
        console.log('Applying the discount code ...');

        let SUB_DISCOUNT_CODE = 'CHARGE_OFF_20';

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

        await fetch(`https://api.rechargeapps.com/charges/${charge_id}/apply_discount`, discountReqOptions);
        console.log(`Discount code ${SUB_DISCOUNT_CODE} applied for the charge number ${count} with ID ${charge_id} for ${product_title}`);

      }
      else{
        console.log(`-- NO DISCOUNT FOR THIS RECURRING ORDER(subscription/created) for ${product_title}  --`);
      }

    }


    console.log('----- Processing of RECURRING charges is complete. -----');

  } catch (error) {
    console.error(error);
  }
});










// Webhook route handler
app.post('/charge', async (req, res) => {
  console.log('========= *** =========');
  console.log('Received charge/created webhook ');
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

   
  


    if(req.body.charge.type == 'RECURRING'){
      console.log('----- This charge is of type RECURRING (charge/created) -----')

      

     
      
      let charge_id = req.body.charge.id;
      //let product_title = req.body.charge.line_items.map(item => item.title).join(', ');


      //Run a loop through all the line items
      req.body.charge.line_items.forEach((line_item, index) => {
        console.log(`Subscription ID for ${index} ===> ${line_item.subscription_id}`);
        console.log(`Product Title for ${index} ===> ${line_item.title}`);

        let subscription_id = line_item.subscription_id;
        let product_title = line_item.title;


        //0. Check the charge number of the charge
        const chargeCountHeaders = new Headers();
        chargeCountHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);

        const chargeOptns = {
        method: "GET",
        headers: chargeCountHeaders
        };

        console.log('====== *** ======')
        console.log(`Making a request to check the charge count for ${product_title}...`)
        fetch(`https://api.rechargeapps.com/charges/count?subscription_id=${subscription_id}`, chargeOptns)
        .then((response) => response.json())
        .then((result) => {
          // console.log(`Result for ${index} ===> ${result}`);
          const count = result.count;
          console.log(`Charge Count for this subscription(inside charge/created webhook) for ${product_title} so far is...`, count)


          //Only proceed if the charge count is equal to or more than 3
          if(count >= 3){
            console.log(`** TAKING ACTION for this charge/created webhook for ${product_title} as the charge count is more than equal to 3 **`);

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
                  console.log(`Property found: ${product_title} 'qualifies for tiered discount':`, property.value);


                  if(property.value == true){
                    console.log('---** This RECURRING ORDER qualifies for discount **---')

                    //4. Apply discount
                    console.log('====== *** ======')
                    console.log('Applying the discount code ...')

                    //4. Apply the subsequent discount based on the count
                    let SUB_DISCOUNT_CODE = ''
                    switch (count) {
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

                    console.log(`Discount to be applied for ${product_title} is ${SUB_DISCOUNT_CODE}`);

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
                              console.log(`Discount code ${SUB_DISCOUNT_CODE} applied for the charge number ${count} with ID ${charge_id} for ${product_title}`)
                              //console.log(result)
                              })
                          .catch((error) => console.error(error));







                  }

                } else {
                  console.log("Property not found: 'qualifies for tiered discount '", `this RECURRING ORDER for ${product_title} does not qualify for discount`);
                }
              }


            })
            .catch((error) => console.error(error));




          }
          else{
            console.log(`** NO ACTION for this charge/created webhook for ${product_title} as the charge count is less than 3 **`);
          }
        
        })
        .catch((error) => console.error(error));





      })


     // return;

    }



});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
