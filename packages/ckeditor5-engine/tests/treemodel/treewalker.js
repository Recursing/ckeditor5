/**
 * @license Copyright (c) 2003-2016, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/* bender-tags: treemodel */

'use strict';

import Document from '/ckeditor5/core/treemodel/document.js';
import Element from '/ckeditor5/core/treemodel/element.js';
import Text from '/ckeditor5/core/treemodel/text.js';
import TreeWalker from '/ckeditor5/core/treemodel/treewalker.js';
import Position from '/ckeditor5/core/treemodel/position.js';
import Range from '/ckeditor5/core/treemodel/range.js';
import CKEditorError from '/ckeditor5/core/ckeditorerror.js';

describe( 'range iterator', () => {
	let doc, expectedItems, expectedItemsMerged, root, img1, paragraph, b, a, r, img2, x;

	before( () => {
		doc = new Document();
		root = doc.createRoot( 'root' );

		// root
		//  |- img1
		//  |- p
		//     |- B
		//     |- A
		//     |- R
		//     |
		//     |- img2
		//     |
		//     |- X

		b = new Text( 'b', { bold: true } );
		a = new Text( 'a', { bold: true } );
		r = new Text( 'r' );
		img2 = new Element( 'img2' );
		x = new Text( 'x' );

		paragraph = new Element( 'p', [], [ b, a, r, img2, x ] );
		img1 = new Element( 'img1' );

		root.insertChildren( 0, [ img1, paragraph ] );

		expectedItems = [
			{ type: 'ELEMENT_START', item: img1 },
			{ type: 'ELEMENT_END', item: img1 },
			{ type: 'ELEMENT_START', item: paragraph },
			{ type: 'CHARACTER', text: 'b', attrs: [ [ 'bold', true ] ] },
			{ type: 'CHARACTER', text: 'a', attrs: [ [ 'bold', true ] ] },
			{ type: 'CHARACTER', text: 'r', attrs: [] },
			{ type: 'ELEMENT_START', item: img2 },
			{ type: 'ELEMENT_END', item: img2 },
			{ type: 'CHARACTER', text: 'x', attrs: [] },
			{ type: 'ELEMENT_END', item: paragraph }
		];

		expectedItemsMerged = [
			{ type: 'ELEMENT_START', item: img1 },
			{ type: 'ELEMENT_END', item: img1 },
			{ type: 'ELEMENT_START', item: paragraph },
			{ type: 'TEXT', text: 'ba', attrs: [ [ 'bold', true ] ] },
			{ type: 'TEXT', text: 'r', attrs: [] },
			{ type: 'ELEMENT_START', item: img2 },
			{ type: 'ELEMENT_END', item: img2 },
			{ type: 'TEXT', text: 'x', attrs: [] },
			{ type: 'ELEMENT_END', item: paragraph }
		];
	} );

	function expectItem( item, expected ) {
		expect( item.done ).to.be.false;

		if ( item.value.type == 'TEXT' || item.value.type == 'CHARACTER' ) {
			let text = item.value.item.text || item.value.item.character;
			let attrs = item.value.item._attrs || item.value.item.first._attrs;

			expect( text ).to.equal( expected.text );
			expect( Array.from( attrs ) ).to.deep.equal( expected.attrs );
			expect( item.value.length ).to.equal( text.length );
		} else {
			expect( item.value.type ).to.equal( expected.type );
			expect( item.value.item ).to.equal( expected.item );

			if ( item.value.type == 'ELEMENT_START' ) {
				expect( item.value.length ).to.equal( 1 );
			} else {
				expect( item.value.length ).to.be.undefined;
			}
		}

		if ( item.value.type == 'TEXT' ) {
			expect( item.value.previousPosition ).to.deep.equal( Position.createBefore( item.value.item.first ) );
		} else if ( item.value.type == 'ELEMENT_END' ) {
			expect( item.value.previousPosition ).to.deep.equal(
				Position.createFromParentAndOffset( item.value.item, item.value.item.getChildCount() ) );
		} else {
			expect( item.value.previousPosition ).to.deep.equal( Position.createBefore( item.value.item ) );
		}

		if ( item.value.type == 'TEXT' ) {
			expect( item.value.nextPosition ).to.deep.equal( Position.createAfter( item.value.item.last ) );
		} else if ( item.value.type == 'ELEMENT_START' ) {
			expect( item.value.nextPosition ).to.deep.equal( Position.createFromParentAndOffset( item.value.item, 0 ) );
		} else {
			expect( item.value.nextPosition ).to.deep.equal( Position.createAfter( item.value.item ) );
		}
	}

	it( 'should return next position', () => {
		let iterator = new TreeWalker( { position: new Position( root, [ 0 ] ) } ); // beginning of root
		let i, len;

		for ( i = 0, len = expectedItems.length; i < len; i++ ) {
			expectItem( iterator.next(), expectedItems[ i ] );
		}
		expect( iterator.next() ).to.have.property( 'done' ).that.is.true;
	} );

	it( 'should return previous position', () => {
		let iterator = new TreeWalker( { position: new Position( root, [ 2 ] ) } ); // ending of root

		for ( let i = expectedItems.length - 1; i >= 0; i-- ) {
			expectItem( iterator.previous(), expectedItems[ i ] );
		}
		expect( iterator.previous() ).to.have.property( 'done' ).that.is.true;
	} );

	it( 'should return next position in the boundaries', () => {
		let start = new Position( root, [ 1, 0 ] ); // p, 0
		let end = new Position( root, [ 1, 3, 0 ] ); // img, 0

		let iterator = new TreeWalker( { boundaries: new Range( start, end ) } );

		let i, len;

		for ( i = 3, len = expectedItems.length; i < 7; i++ ) {
			expectItem( iterator.next(), expectedItems[ i ] );
		}
		expect( iterator.next() ).to.have.property( 'done' ).that.is.true;
	} );

	it( 'should return previous position in the boundaries', () => {
		let start = new Position( root, [ 1, 0 ] ); // p, 0
		let end = new Position( root, [ 1, 3, 0 ] ); // img, 0

		let iterator = new TreeWalker( { boundaries: new Range( start, end ), position: end } );

		let i, len;

		for ( i = 6, len = expectedItems.length; i > 2; i-- ) {
			expectItem( iterator.previous(), expectedItems[ i ] );
		}
		expect( iterator.previous() ).to.have.property( 'done' ).that.is.true;
	} );

	it( 'should merge characters when iterating over the range using next', () => {
		let start = new Position( root, [ 1 ] );
		let end = new Position( root, [ 1, 4 ] );
		let range = new Range( start, end );

		let iterator = new TreeWalker( { boundaries: range, position: range.start, mergeCharacters: true } );
		let i;

		for ( i = 2; i <= 6; i++ ) {
			expectItem( iterator.next(), expectedItemsMerged[ i ] );
		}
		expect( iterator.next() ).to.have.property( 'done' ).that.is.true;
	} );

	it( 'should merge characters when iterating over the range using previous', () => {
		let start = new Position( root, [ 1 ] );
		let end = new Position( root, [ 1, 4 ] );
		let range = new Range( start, end );

		let iterator = new TreeWalker( { boundaries: range, position: range.end, mergeCharacters: true } );

		for ( let i = 6; i >= 2; i-- ) {
			expectItem( iterator.previous(), expectedItemsMerged[ i ] );
		}
		expect( iterator.previous() ).to.have.property( 'done' ).that.is.true;
	} );

	it( 'should respect boundaries when iterating using next and merging characters', () => {
		let start = new Position( root, [ 1, 0 ] );
		let end = new Position( root, [ 1, 1 ] );
		let range = new Range( start, end );

		let iterator = new TreeWalker( { boundaries: range, position: range.start, mergeCharacters: true } );
		let val = iterator.next();

		expect( val.done ).to.be.false;
		expect( val.value.item.text ).to.equal( 'b' );

		val = iterator.next();
		expect( val.done ).to.be.true;
	} );

	it( 'should respect boundaries when iterating using previous and merging characters', () => {
		let start = new Position( root, [ 1, 1 ] );
		let end = new Position( root, [ 1, 2 ] );
		let range = new Range( start, end );

		let iterator = new TreeWalker( { boundaries: range, position: range.end, mergeCharacters: true } );
		let val = iterator.previous();

		expect( val.done ).to.be.false;
		expect( val.value.item.text ).to.equal( 'a' );

		val = iterator.previous();
		expect( val.done ).to.be.true;
	} );

	it( 'should throw if neither boundaries nor starting position is set', () => {
		expect( () => {
			new TreeWalker();
		} ).to.throw( CKEditorError, /^tree-walker-no-start-position/ );

		expect( () => {
			new TreeWalker( {} );
		} ).to.throw( CKEditorError, /^tree-walker-no-start-position/ );

		expect( () => {
			new TreeWalker( { mergeCharacters: true } );
		} ).to.throw( CKEditorError, /^tree-walker-no-start-position/ );
	} );
} );
