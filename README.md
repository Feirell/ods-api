# ODS-API

This package provides an easy to use access to the ODS (Online Dienst für Studierende) platform used by the FH Dortmund.

Be awere that this package is an html parser for the provided page, all data is given by the webpage and there is no liability for their accuracy in any way.

Since this is a parser, there might be breaking changes which could completely break the data provided by this package. Please file an GitHub issue if you encounter any problems or wrong data.

This package will cache the polled html page. `getMetaInformation`, `getGradesSummary` and `getGrades` use this cache to parse the provided data. The cache has a client side timeout (default 100 minutes). You can clear this cache with `clearCache()` or you could use the `useCache` parameter in any of the three get methodes to ignore the cache timeout and request a new version of the html page, this will result in the same behavior as if you would call `clearCache` and then the methode. You can set the `cacheTimeout` attribute to change the cache timeout (number in milliseconds).

Please see [ODSConnection](https://feirell.github.io/ods-api/classes/_index_.odsconnection.html) for a detailed API documentation.

## Examples

### 1. example - ES8 async await

<!-- USEFILE: example\example-01.js -->
``` js
const { ODSConnection } = require('ods-api');

(async () => {
    const conn = await ODSConnection.login('username', 'password');

    if (conn == null)
        throw new Error('either username and / or password was wrong or the the ods service was not reachable');

    const metaInformation = await conn.getMetaInformation();
    const gradesSummy = await conn.getGradesSummary();
    const grades = await conn.getGrades();

    require('fs').writeFileSync(metaInformation.matriculationNumber + '.json', JSON.stringify({ metaInformation, gradesSummy, grades }, undefined, 4));
})()
    .catch(console.error);
```
*You can find this in `example\example-01.js`*

### 2. example - ES6 with Promise 

<!-- USEFILE: example\example-02.js -->
``` js
const { ODSConnection } = require('ods-api');

ODSConnection.login('username', 'password')
    .then(conn => {
        if (conn == null)
            throw new Error('either username and / or password was wrong or the the ods service was not reachable');
        else
            return Promise.all([
                conn.getMetaInformation(),
                conn.getGradesSummary(),
                conn.getGrades()

            ]);
    })
    .then(([metaInformation, gradesSummy, grades]) => {
        require('fs').writeFileSync(metaInformation.matriculationNumber + '.json', JSON.stringify({ metaInformation, gradesSummy, grades }, undefined, 4))
    })
    .catch(console.error);
```
*You can find this in `example\example-02.js`*



