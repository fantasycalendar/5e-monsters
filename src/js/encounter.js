import * as lib from "./lib.js";
import CONST from "./constants.js";

const encounter = {

    groups: [],

    get totalExp() {
        return this.groups.reduce((acc, group) => {
            return acc + (group.monster.cr.exp * group.count);
        }, 0);
    },

    get totalMonsters() {
        return this.groups.reduce((acc, group) => acc + group.count, 0);
    },

    get adjustedExp() {
        const multiplier = this.getMultiplier(this.totalMonsters);
        return Math.floor(this.totalExp * multiplier);
    },

    get actualDifficulty() {

        const exp = this.adjustedExp;
        const levels = this.app.party.experience;

        if (exp === 0){
            return "None";
        }else if (exp < (levels.easy)) {
            return "Nuisance";
        } else if (exp < (levels.medium)) {
            return "Easy";
        } else if (exp < (levels.hard)) {
            return "Medium";
        } else if (exp < (levels.deadly)) {
            return "Hard";
        }

        return "Deadly";
    },

    insaneDifficultyStrings: [
        "an incredibly bad idea",
        "suicide",
        "/r/rpghorrorstories",
        "an angry table",
        "the BBEG wrote this encounter",
        "the party's final session",
        "someone forgot to bring snacks",
        "rocks fall",
        "someone insulted the DM",
    ],

    get difficultyFeel() {
        const exp = this.adjustedExp;
        if(exp === 0) return "";

        const levels = Object.entries(this.app.party.experience);
        for(let i = 1; i < levels.length; i++){
            const [lowerKey, lowerValue] = levels[i-1];
            const [upperKey, upperValue] = levels[i];
            const ratio = lib.ratio(lowerValue, upperValue, exp);

            if(upperKey === "daily" && ratio >= 0.0) {
                if (ratio >= 0.2) {
                    return ratio >= 1.0
                        ? "Feels like " + lib.randomArrayElement(this.insaneDifficultyStrings)
                        : ratio >= 0.6 ? 'Feels extremely deadly' : "Feels really deadly";
                }
                return "Feels " + lowerKey;
            }else if(ratio >= 0.0 && ratio <= 1.0){
                if (ratio > 0.7) {
                    return "Feels " + upperKey;
                }
                return "Feels " + lowerKey;
            }
        }

        const ratio = lib.ratio(0, levels[0][1], exp);
        return ratio > 0.5 ? "Feels like a nuisance" : "Feels like a minor nuisance";
    },

    get threat() {

        const totalPlayers = this.app.party.totalPlayers;
        const experience = this.app.party.experience;
        const mediumExp = experience.medium;
        let singleMultiplier = 1;
        let pairMultiplier = 1.5;
        let groupMultiplier = 2;
        let trivialMultiplier = 2.5;

        if (totalPlayers < 3) {
            // For small groups, increase multiplier
            singleMultiplier = 1.5;
            pairMultiplier = 2;
            groupMultiplier = 2.5;
            trivialMultiplier = 3;
        } else if (totalPlayers > 5) {
            // For large groups, reduce multiplier
            singleMultiplier = 0.5;
            pairMultiplier = 1;
            groupMultiplier = 1.5;
            trivialMultiplier = 2;
        }

        return {
            deadly: Math.floor(experience.deadly / singleMultiplier),
            hard: Math.floor(experience.hard / singleMultiplier),
            medium: Math.floor(mediumExp / singleMultiplier),
            easy: Math.floor(experience.easy / singleMultiplier),
            pair: Math.floor(mediumExp / (2 * pairMultiplier)),
            group: Math.floor(mediumExp / (4 * groupMultiplier)),
            trivial: Math.floor(mediumExp / (8 * trivialMultiplier)),
        };

    },

    generateRandom() {
        const totalExperienceTarget = this.app.party.experience[this.app.difficulty];
        let fudgeFactor = 1.1; // The algorithm is conservative in spending exp; so this tries to get it closer to the actual medium value
        let baseExpBudget = totalExperienceTarget * fudgeFactor;
        let encounterTemplate = this.getEncounterTemplate();
        let multiplier = this.getMultiplier(encounterTemplate.total) / encounterTemplate.multiplier;
        let totalAvailableXP = baseExpBudget / multiplier;

        let targetExp;
        const encounter = []
        for (const group of encounterTemplate.groups) {

            targetExp = encounterTemplate.subtractive ? (totalAvailableXP / encounterTemplate.groups.length) : (totalAvailableXP * group.ratio);

            targetExp /= group.count;

            const monster = this.getBestMonster(targetExp, encounter, group.count);
            if (!monster) {
                return false;
            }

            encounter.push({
                monster, count: group.count
            })

            if (encounterTemplate.subtractive) {
                targetExp -= group.count * monster.cr.exp;
            }
        }

        this.groups = encounter;

        this.app.encounterHistory = [...this.app.encounterHistory, this.groups.map(group => {
            return {
                monster: {
                    name: group.monster.name,
                    slug: group.monster.slug
                },
                count: group.count
            }
        })];

    },

    getBestMonster(targetExp, encounter, numMonsters) {

        let monsterCRIndex;
        for (let i = 0; i < CONST.CR.LIST.length; i++) {
            const lowerBound = CONST.CR[CONST.CR.LIST[i]];
            const upperBound = CONST.CR[CONST.CR.LIST[i + 1]];
            if (upperBound.exp > targetExp) {
                monsterCRIndex = (targetExp - lowerBound.exp) < (upperBound.exp - targetExp) ? i : i + 1;
                break;
            }
        }

        let monsterTargetCR = CONST.CR[CONST.CR.LIST[monsterCRIndex]];
        let monsterList = this.app.filterMonsters(monsterTargetCR.string, (monster) => {
            return !encounter.some(group => group.monster === monster) && !(numMonsters > 1 && monster.isUnique);
        });

        let monsterCRNewIndex = monsterCRIndex;
        let down = true;
        while (!monsterList.length) {

            if (down) {
                monsterCRNewIndex--;
                if (monsterCRNewIndex < 0) {
                    monsterCRNewIndex = monsterCRIndex;
                    down = false;
                }
            } else {
                monsterCRNewIndex++;
                if (monsterCRNewIndex === CONST.CR.LIST.length - 1) {
                    return false;
                }
            }

            let monsterTargetCR = CONST.CR[CONST.CR.LIST[monsterCRNewIndex]];
            monsterList = this.app.filterMonsters(monsterTargetCR.string, (monster) => {
                return !encounter.some(group => group.monster === monster);
            });

        }

        return lib.randomArrayElement(monsterList);

    },

    getEncounterTemplate() {

        let template = lib.clone(CONST.ENCOUNTER_TYPES[this.app.encounterType]);

        if (template.samples) {
            template = lib.randomArrayElement(template.samples);
            if (this.app.encounterType === "random") {
                template = {
                    subtractive: true,
                    groups: template.map(num => {
                        return { count: num }
                    })
                };
            }
        }

        const players = Number(this.app.party.totalPlayers);
        template.groups = template.groups.map(group => {
            if(typeof group.count === "string"){
                const parts = group.count.split('-').map(part => {
                    part = part.replaceAll("players", players);
                    return eval(part);
                });
                group.count = parts.length > 1 ? lib.randomIntBetween(...parts) : parts[0];
            }
            return group;
        });

        template.total = template.groups.reduce((acc, group) => acc + group.count, 0);

        if (this.app.encounterType === "random") {
            template.overallRatio = template.groups.reduce((acc, group) => acc + (group.ratio || 1), 0);
            template.groups.forEach(group => {
                group.ratio = (group.ratio || 1) / template.overallRatio;
            });
        }

        template.multiplier = template.multiplier || 1;

        return template;

    },

    getMultiplier(numMonsters) {

        let multiplierCategory;
        const multipliers = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

        if (numMonsters <= 3) {
            multiplierCategory = Math.max(1, numMonsters);
        } else if (numMonsters < 7) {
            multiplierCategory = 3;
        } else if (numMonsters < 11) {
            multiplierCategory = 4;
        } else if (numMonsters < 15) {
            multiplierCategory = 5;
        } else {
            multiplierCategory = 6;
        }

        if (this.app.party.totalPlayers < 3) {
            multiplierCategory++;
        } else if (this.app.party.totalPlayers > 5) {
            multiplierCategory--;
        }

        return multipliers[multiplierCategory];

    },

    getNewMonster(group) {
        const monsterList = this.app.filterMonsters(group.monster.cr.string, (monster) => {
            return !this.groups.some(group => group.monster === monster);
        });
        if (!monsterList.length) return;
        group.monster = lib.randomArrayElement(monsterList);
    },

    addMonster(monster){

        let group;
        let index = this.groups.findIndex(group => group.monster === monster);
        if(index === -1) {
            group = {
                monster,
                count: 1
            };
        }else{
            group = this.groups[index];
            group.count++;
        }

        if(!this.groups.length){
            this.app.encounterHistory.push([{
                monster: {
                    name: monster.name,
                    slug: monster.slug
                },
                count: 1
            }])
        }else{
            const lastEntry = this.app.encounterHistory[this.app.encounterHistory.length-1];
            if(index === -1){
                lastEntry.push({
                    monster: {
                        name: monster.name,
                        slug: monster.slug
                    },
                    count: 1
                })
            }else{
                lastEntry[index].count++;
            }
        }

        if(index === -1) {
            this.groups.push(group)
        }
    },

    addCount(index){
        this.groups[index].count++;
        this.app.encounterHistory[this.app.encounterHistory.length-1][index].count++;
    },

    subtractCount(index){
        this.groups[index].count--;
        this.app.encounterHistory[this.app.encounterHistory.length-1][index].count--;
        if(this.groups[index].count <= 0){
            this.groups.splice(index, 1);
            const lastEntry = this.app.encounterHistory[this.app.encounterHistory.length-1];
            lastEntry.splice(index, 1);
            if(!lastEntry.length){
                this.app.encounterHistory.pop();
            }
        }
    },

    save(){
        if(!this.groups.length) return;
        const encounter = this.groups.map(group => {
            return {
                monster: {
                    name: group.monster.name,
                    slug: group.monster.slug
                },
                count: group.count
            }
        });
        if(this.app.loadedEncounterIndex){
            this.app.savedEncounters[this.app.loadedEncounterIndex] = encounter;
        }else {
            this.app.savedEncounters = [...this.app.savedEncounters, encounter];
            this.app.loadedEncounterIndex = this.app.savedEncounters.length - 1;
        }
    },

    loadFromHistory(index){

        const encounter = this.app.encounterHistory.splice(index, 1)[0];
        this.app.encounterHistory.push(encounter);

        this.load(encounter);

    },

    load(encounter){
        const groups = lib.clone(encounter).map(group => {
            group.monster = this.app.monsterLookupTable[group.monster.slug];
            if (!group.monster) return false;
            return group;
        }).filter(Boolean);
        if(!groups.length) return;
        this.groups = groups;
    }

}

export default encounter;

/*
		function getBestMonster(targetExp, filters) {

			monsterList = randomEncounter.getShuffledMonsterList(metaInfo.crList[crIndex].string);

			while ( true ) {
				if ( monsterLib.checkMonster(monsterList[0], filters, { skipCrCheck: true, nonUnique: true }) ) {
					return monsterList[0];
				} else {
					monsterList.shift();
				}

				// If we run through all the monsters from this level, check a different level
				if ( monsterList.length === 0 ) {
					// there were no monsters found lower than target exp, so we have to start checking higher
					if ( currentIndex === 0 ) {
						// Reset currentIndex
						currentIndex = crIndex;
						// Start looking up instead of down
						step = 1;
					}

					currentIndex += step;
					monsterList = randomEncounter.getShuffledMonsterList(metaInfo.crList[currentIndex].string);
				}
			}
		}
	}
})();




 */