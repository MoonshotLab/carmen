const express = require('express');
const router = express.Router();
const path = require('path');
const vCard = require('vcards-js');

const publicPath = path.resolve(__dirname, '../public');
const logoPath = path.join(publicPath, 'img/logo.jpg');

function getCarmenVcard() {
  const card = vCard();

  card.firstName = 'Carmen';
  card.organization = 'Barkley';
  card.photo.embedFromFile(logoPath);
  card.workPhone = '816-298-9138';
  card.workAddress.street = '1740 Main';
  card.workAddress.city = 'Kansas City';
  card.workAddress.stateProvince = 'MO';
  card.workAddress.postalCode = '64108';

  return card;
}

router.get('/', (req, res) => {
  const card = getCarmenVcard();

  res.set('Content-Type', 'text/vcard; name="carmen.vcf"');
  res.set('Content-Disposition', 'inline; filename="carmen.vcf"');

  //send the response
  res.send(card.getFormattedString());
});

module.exports = router;
