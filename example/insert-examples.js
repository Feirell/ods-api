const fs = require('fs');
const path = require('path');
const matcher = /<!-- USEFILE: ?(.+?) -->(?:\r?\n)?(?:```(?:.|\r?\n)*?```)?/g;

const readFileAsync = (path, options) => new Promise((res, rej) => {
    fs.readFile(path, options, (err, data) => {
        if (err)
            rej(err)
        else
            res(data)
    })
});

const writeFileAsync = (path, content, options) => new Promise((res, rej) => {
    fs.writeFile(path, content, options, (err, data) => {
        if (err)
            rej(err)
        else
            res(data)
    })
})

async function replaceAsync(str, matcher, asyncFunction) {
    matcher.lastIndex = 0;
    const matches = [];

    let match;
    while ((match = matcher.exec(str)) != null) {
        matches.push({
            match,
            end: matcher.lastIndex,
            replace: asyncFunction(...match)
        });
    }

    let newStrParts = [];
    let prev = 0;

    for (let { match, replace, end } of matches) {
        newStrParts.push(
            str.slice(prev, end - match[0].length),
            await replace
        );

        prev = end;
    }

    if (prev < str.length)
        newStrParts.push(str.slice(prev, str.length));

    return newStrParts.join('');
}

async function insertCodeBlocks(insertIn) {
    insertIn = path.resolve(insertIn);
    const fc = await readFileAsync(insertIn, 'utf8');
    const lineSep = /\r\n/.test(fc) ? '\r\n' : '\n';

    newFc = await replaceAsync(fc, matcher, async (whole, filename) => {
        const subFc = await readFileAsync(filename, 'utf8');
        const relativePath = path.relative(path.dirname(insertIn), filename);
        return "<!-- USEFILE: " + relativePath.replace(/\\/g, '\\\\') + " -->" + lineSep + "```" + path.extname(filename).slice(1) + lineSep + subFc + lineSep + '```';
    })

    await writeFileAsync(insertIn, newFc, 'utf8');
}

insertCodeBlocks(process.argv[2])
    .catch(err => console.error(err) && process.exit(1));