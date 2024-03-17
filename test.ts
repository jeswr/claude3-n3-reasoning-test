import Anthropic from '@anthropic-ai/sdk';
import { n3reasoner, SwiplEye, queryOnce } from 'eyereasoner';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Lessons: API usage allowance is proportional to the number of tokens input.
// This setup costs around $3 USD

(async () => {
    // const SWIPL = await SwiplEye();
    // await queryOnce(SWIPL, 'main', ['--help'])
    // (await SWIPL).prolog.consult('src/ontology.pl');
    // defaults to process.env["ANTHROPIC_API_KEY"]
    const urls = [
        [
            "https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/3outof5/sample.n3",
            "https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/3outof5/query.n3",
            "https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/3outof5/proof.n3"
        ],
        [
            "https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/socrates/socrates.n3",
            "https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/socrates/socrates-query.n3",
            "https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/socrates/socrates-proof.n3",

        ],
        [
            undefined,
            "https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/peano/peano.n3",
            "https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/peano/peano-proof.n3"
        ]
    ]

    const texts = await Promise.all(urls.map(async ([sample, query, proof]) => {
        return {
            sample: { content: sample && await (await fetch(sample)).text(), name: sample },
            query: { content: query && await (await fetch(query)).text(), name: query },
            proof: { content: proof && await (await fetch(proof)).text(), name: proof }
        }
    }));

    let content = "The following attachments are sample of Notation3 data, queries and proof. You will use this information to assist in writing your own proofs for users."

    let i = 0;
    for (const { sample, query, proof } of texts) {
        content += `\nDATA ${i++} (source file [${sample.name}]):\n${'-'.repeat(100)}`
        content += sample.content;
        content += `\n${'-'.repeat(100)}\nQUERY ${i++} (source file [${query.name}]):\n${'-'.repeat(100)}`
        content += query.content;
        content += `\n${'-'.repeat(100)}\nPROOF ${i++} (source file [${proof.name}]): \n${'-'.repeat(100)}`;
        content += proof.content;
        content += `\n${'-'.repeat(100)}\n`;
    }

    content += `Produce an answer and proof of the following query. Your response should not inlcude any text except for the proof.`

    // FIXME: I need to supply data and query
    const sample = "https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/seq/seq_components.n3";
    const query = "https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/seq/seq_query.n3";
    // content += await (await fetch(sample)).text();
    
    content += `\nDATA (source file [${sample}]):\n${'-'.repeat(100)}`
    content += await (await fetch(sample)).text();
    content += `\n${'-'.repeat(100)}\nQUERY ${i++} (source file [${query}]):\n${'-'.repeat(100)}`
    content += await (await fetch(query)).text();
    // content += `\n${'-'.repeat(100)}\nPROOF ${i++} (source file [${proof}]): \n${'-'.repeat(100)}`;
    // content += proof;
    // content += `\n${'-'.repeat(100)}\n`;

    const initMsg = { role: "user", content }

    fs.writeFileSync(path.join(__dirname, 'messages', 'query_msg.json'), JSON.stringify(initMsg, null, 2));
    
    
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 1024 * 4,
        messages: [
            { role: "user", content },
            // { role: "user", content: "The following attachments are sample pairs of Notation3 queries and proof. You will use this information to assist in writing your own proofs for users." },
            // {
            //     role: "user", content: [{
            //         text: await (await fetch("https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/3outof5/query.n3")).text(),
            //         type: "text"

            //     }, {
            //         text: await (await fetch("https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/3outof5/proof.n3")).text(),
            //         type: "text"

            //     }]
            // },
            // {
            //     role: "user", content: [{
            //         text: await (await fetch("https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/pptbank/query.n3")).text(),
            //         type: "text"

            //     }, {
            //         text: await (await fetch("https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/pptbank/proof.n3")).text(),
            //         type: "text"

            //     }]
            // },
            // {
            //     role: "user", content: [{
            //         text: await (await fetch("https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/gps/gps-query1.n3")).text(),
            //         type: "text"

            //     }, {
            //         text: await (await fetch("https://raw.githubusercontent.com/eyereasoner/eye/master/reasoning/gps/gps-proof1.n3")).text(),
            //         type: "text"

            //     }]
            // },
            // { role: "user", content: "Produce an answer and proof of the following query. Your response should not inlcude any text except for the proof." },
            // {
            //     role: "user", content: [{
            //         text: await (await fetch("https://github.com/eyereasoner/eye/blob/master/reasoning/peano/peano.n3")).text(),
            //         type: "text"

            //     }]
            // },
        ],
    });
    fs.writeFileSync(path.join(__dirname, 'messages', 'answer_msg.json'), JSON.stringify(msg, null, 2));
    console.log(msg);
})();
