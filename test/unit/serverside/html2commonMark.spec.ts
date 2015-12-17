import tests = require('./read-commonmark-tests');
import chai = require('chai');
import Parser = require('../../../src/Parser');
import commonmark = require('commonmark');
import compareHtml = require('./compare-html');
let sut = new Parser();

let expect = chai.expect;
let parser = new commonmark.Parser();


function normalizeTree(root: commonmark.Node) {
	let walker = root.walker();
	let current: commonmark.WalkingStep;
	while (current = walker.next()) {
		let currentNode = current.node;
		if (currentNode.type === 'Text' && currentNode.next && currentNode.next.type === 'Text') {
			let newNode = new commonmark.Node('Text');
			currentNode.parent.appendChild(newNode);
			newNode.literal = currentNode.literal + currentNode.next.literal;
			currentNode.insertBefore(newNode);
			currentNode.next.unlink();
			currentNode.unlink();
			walker.resumeAt(newNode);
		}
		
		if(currentNode.type === 'Image'){
			/* 
			"Though this spec is concerned with parsing, not rendering, it is recommended that in rendering to HTML, only the plain string content of the image description be used. Note that in the above example, the alt attribute’s value is foo bar, not foo [bar](/url) or foo <a href="/url">bar</a>. Only the plain string content is rendered, without formatting."
			 - http://spec.commonmark.org/0.22/#images
			 
			 So normalize the content to be just one text node is fine
			*/
			let text = '';
			while( (current = walker.next()).node !== currentNode){
				if(current.entering && current.node.literal){
					text += current.node.literal;
				}
			}
			while(currentNode.firstChild){
				currentNode.firstChild.unlink();
			}
			let textNode = new commonmark.Node('Text');
			textNode.literal = text;
			currentNode.appendChild(textNode);
		}
	}
	return root;
}

let assertEqual = (astExpected: commonmark.Node, astActual: commonmark.Node) => {
	let expectedWalker = astExpected.walker();
	let actualWalker = astActual.walker();
	let expectedValue: commonmark.WalkingStep;

	// console.log('expected: ', new commonmark['XmlRenderer']().render(astExpected));
	// console.log('actual: ', new commonmark['XmlRenderer']().render(astActual));
	while (expectedValue = expectedWalker.next()) {
		var actualValue = actualWalker.next();
		console.log(`verifying that: ${actualValue.node.type }/${actualValue.node.literal} is ${expectedValue.node.type}/${expectedValue.node.literal}`);
		expect(actualValue).to.be.ok;
		['type', 'level', 'title', 'destination'].forEach
			(prop => expect(actualValue.node[prop], `comparing ${prop} of ${expectedValue.node.type}`).to.be.equal(expectedValue.node[prop]));

		assertLiteral(expectedValue.node, actualValue.node);
		
		// Sometimes 'info' (from CodeBlock) is null vs empty string. Not sure how to detect the differences
		if (expectedValue.node.info === null || expectedValue.node.info === '') {
			expect(actualValue.node.info === null || actualValue.node.info === '', `Expecting 'info' of ${expectedValue.node.type} to be null or empty, was ${actualValue.node.info}`).to.be.equal(true);
		} else {
			// When the expected node type contains spaces, that info is lost after rendering
			let expectedInfo = expectedValue.node.info;
			if (expectedInfo) {
				let indexOfSpace = expectedInfo.indexOf(' ');
				if (indexOfSpace >= 0) {
					expectedInfo = expectedInfo.substr(0, indexOfSpace);
				}
			}
			expect(actualValue.node.info, `comparing info of ${expectedValue.node.type}`).to.be.equal(expectedInfo);
		}

		if (expectedValue.node.type === 'list') {
			['listTight', 'listTight', 'listStart', 'listDilimiter'].forEach(prop => expect(actualValue.node[prop]).to.be.equal(expectedValue.node[prop]));
		}
		expect(actualValue.entering).to.be.equal(expectedValue.entering);
	}
}

var assertLiteral = (expecedValue: commonmark.Node, actualValue: commonmark.Node) => {
	if (expecedValue.type === 'HtmlBlock' || expecedValue.type === 'Html') {
		// Compare the dom
		compareHtml(expecedValue.literal, actualValue.literal);
	} else {
		expect(actualValue.literal, `comparing literal of ${expecedValue.type}`).to.be.equal(expecedValue.literal);
	}
}

describe('CommonMark => html', () => {
	var excluded = [106, 107, 110, 111, 112, 113, 116, 119, 120, 122, 123, 124, 282, 286, 292, 308, 435, 436, 437, 449, 559, 559, 560, 561, 562, 563, 569];
	var excludedSections = ['HTML blocks'];
	var scoped: Array<number> = [];
	for (var i = 0; i < 572; i++) {
		if (excluded.indexOf(i) < 0) {
			scoped.push(i);
		}
	}
	// scoped = [571];
	tests.filter(t => scoped.indexOf(t.example) >= 0 && excludedSections.indexOf(t.section) < 0).forEach(test => {
		it(`test #${test.example}, section ${test.section}: "${test.html }" ==> "${test.markdown}"`, (done) => {
			sut.parse(test.html).then(result => {
				try {
					assertEqual(normalizeTree(parser.parse(test.markdown)), result);
					done();
				} catch (error) {
					done(error);
				}
			}, done);
		});
	});
});