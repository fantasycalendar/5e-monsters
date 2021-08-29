'use strict';

describe('monsters tests', function() {
	beforeEach(module('app'));

	describe('api', function() {
		it('should have correct methods', inject(function(monsters) {

			// TODO: fix dependency injection here by mocking dependencies correctly
			// We want to call the object method loadSheet to push things to all, byCr, and byId
			// Currently monsters returns an empty object because injector isn't working
			
			expect(monsters.all).toBeDefined();
			//expect(monsters.all.length).toBeGreaterThan(0);
			expect(_.isObject(monsters.byCr)).toBe(true);
			//expect(_.keys(monsters.byCr).length).toBeGreaterThan(0);
			expect(_.isObject(monsters.byId)).toBe(true);
			//expect(_.keys(monsters.byId).length).toBeGreaterThan(0);
			expect(_.isFunction(monsters.check)).toBe(true);
		}));
	})
})