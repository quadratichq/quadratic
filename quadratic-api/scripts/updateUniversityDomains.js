const fs = require('fs');
const path = require('path');

// Fetch data from repo, filter it down to just what we need, then save it to disk
fetch('https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json')
  .then((response) => response.json())
  .then((data) => {
    const domains = data.map(({ domains }) => domains).flat();
    fs.writeFileSync(path.join(__dirname, '../src/data/universityDomains.json'), JSON.stringify(domains));
  })
  .catch((error) => {
    console.error('Failed to fetch and save latest data', error);
  });
