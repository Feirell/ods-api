# ODS-API

This package provides an easy to use access to the ODS (Online Dienst für Studierende) platform used by the FH Dortmund.

## `example-01.js`
```js
const ODSConnection = require('ods-api');

(async () => {
    const conn = await ODSConnection.login('username', 'password');
    if (conn == null)
        throw new Error('either username and / or password was wrong or the the ods service was not reachable');

    const grades = await conn.getGrades();
    require('fs').writeFileSync('grades.json', JSON.stringify(grades, undefined, 4));
})()
    .catch(console.error);
```