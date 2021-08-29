(function() {
	'use strict';

	angular.module("app")
		.factory("monsters", [
			'$rootScope',
			'misc',
			'monsterFactory',
			Monsters
		]);
		
	var all = [];
	var byId = {};
	var byCr = {};
	var loaded = {};
	var sourcesById = {};

	function Monsters($rootScope, miscLib, monsterFactory) {
		// defines the factory function that will create a service instance Monsters when called
		// the service instance has
		// * properties: all, byCr, byId, and check (a boolean), 
		// * methods: loadSheet, removeSheet (bound method)

		function loadSheet(args) {
			// checks if a sheet has been loaded, and if not, loads monsters from that sheet

			var sheets = args.sheets;
			var sheetId = args.sheetId;
			var custom = args.custom;

			if ( loaded[sheetId] ) {
				// Don't allow a source to be loaded multiple times
				return;
			}

			loaded[sheetId] = true;

			loadMonsters({
				$rootScope: $rootScope,
				miscLib: miscLib,
				monsterFactory: monsterFactory,
				sheetId: sheetId,
				custom: custom,
				sheets: sheets,
			});
		}

		return {
			all: all,
			byCr: byCr,
			byId: byId,
			check: monsterFactory.checkMonster,
			loadSheet: loadSheet,
			removeSheet: removeSheet.bind(null, miscLib),
		};
	}

	function loadMonsters(args) {
		var $rootScope = args.$rootScope;
		var miscLib = args.miscLib;
		var monsterFactory = args.monsterFactory;
		var sheetId = args.sheetId;
		var custom = args.custom;
		var sheets = args.sheets;

		// for each object Monsters in sheets, iterate with this function
		sheets.Monsters.forEach(function (monsterData) {
			
			// only set the sheetId of the new object monsterData 
			monsterData.sheetId = sheetId;
			
			// create new monster with given sheetId
			// this is as specified by the Monster constructor in monsterFactory
			// all other attributes are not set (yet)
			var monster = new monsterFactory.Monster(monsterData);
		
			if ( byId[monster.id] ) {
				// We already have this monster from some other source, so just merge it
				// with the existing entry
				byId[monster.id].merge(monster)
				let sources = new Set(byId[monster.id].sources.map(source => JSON.stringify(source)))
				byId[monster.id].sources = Array.from(sources).map(source => JSON.parse(source));
				return;
			}
			
			// now push this monster on to the all array
			all.push(monster);

			// and set it to be loaded
			byId[monster.id] = monster;

			// if we haven't added the monster's CR (as a string), then leave it empty
			if ( ! byCr[monster.cr.string] ) {
				byCr[monster.cr.string] = [];
			}

			byCr[monster.cr.string].push(monster);
		});

		sourcesById[sheetId] = [];
		sheets.Sources.forEach(function (sourceData) {
			var name = sourceData.name;
			var shortName = sourceData.shortname;
			var initialState = custom || !!(sourceData.defaultselected || "").match(/yes/i);

			if ( miscLib.sourceFilters[name] !== undefined ) {
				console.warn("Duplicate source", name);
				return;
			}

			sourcesById[sheetId].push(name);
			miscLib.sources.push(name);
			miscLib.sourceFilters[name] = initialState;
			miscLib.shortNames[name] = shortName;

			if ( !miscLib.sourcesByType[sourceData.type] ) {
				miscLib.sourcesByType[sourceData.type] = [];
			}

			miscLib.sourcesByType[sourceData.type].push(name);

			if ( custom ) {
				$rootScope.$broadcast("custom-source-added", name);
			}
		});

		miscLib.sources.sort();

		all.sort(function (a, b) {
			return (a.name > b.name) ? 1 : -1;
		});
	}

	function removeSheet(miscLib, id) {
		var i = 0;
		var monsterId;
		var crString;
		var crIndex;

		// No longer mark sheet as loaded
		delete loaded[id];

		// Loop through all the monsters and remove them from all and byCr
		while ( all[i] ) {
			if ( all[i].sheetId === id ) {
				monsterId = all[i].id;
				delete byId[monsterId];
				crString = all[i].cr.string;
				crIndex = byCr[crString].indexOf(all[i]);
				if ( crIndex !== -1 ) {
					byCr[crString].splice(crIndex, 1);
				}
				all.splice(i, 1);
			} else {
				i++;
			}
		}

		if ( !sourcesById[id] ) {
			return;
		}

		// Loop through sources and remove them
		sourcesById[id].forEach(function (sourceName) {
			i = miscLib.sources.indexOf(sourceName);
			miscLib.sources.splice(i, 1);
			delete miscLib.sourceFilters[name];
			delete miscLib.shortNames[name];
		});

		delete sourcesById[id];
	}
})();
