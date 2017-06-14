/* eslint-env jasmine */
const scraper = require('../../server/lib/scraper');
const {randomData, comprehensiveData} = require('../../server/lib/mock-data');
const fs = require('fs');
const _ = require('lodash');

/**
 * Unfortunately, Jasmine doesn't natively support async/await, so we have to use this convenient wrapper function
 * that I *totally* didn't steal off of https://github.com/jasmine/jasmine/issues/923 (thank you @jamesthurley!)
 */
function wrapper(async) {
	return done => {
		async().then(done, e => {
			fail(e);
			done();
		});
	};
}

describe('lib', () => {
	describe('mock-data', () => {
		describe('randomData', () => {
			it('has a random length', () => {
				let arr1 = randomData();
				let arr2 = randomData();
				let arr3 = randomData();

				expect(arr1.length === arr2.length === arr3.length).toBeFalsy();
			});

			it('is random', () => {
				let arr1 = randomData();
				let arr2 = randomData();

				expect(arr1).not.toEqual(arr2);
			});
		});

		describe('thoroughData', () => {
			it('is thorough', () => {
				let arr = comprehensiveData();

				let types = _.map(arr, m => m.type);
				let expected = ['Dryer', 'Washer'];
				let actual = _.sort(_.intersection(types, expected), String, 'asc');
				expect(actual).toBe(expected);

				let statuses = _.map(arr, m => m.status);
				expected = ['Almost Done', 'Available', 'End of Cycle', 'In Use'];
				actual = _.sort(_.intersection(statuses, expected), String, 'asc');
				expect(actual).toBe(expected);

				let times = _.map(arr, m => m.time);
				expected = [' ', '0 minutes left', '1 minute left', '5 minutes left']; // Just enough to represent all the statuses
				actual = _.sort(_.intersection(times, expected), String, 'asc');
				expect(actual).toBe(expected);
			});

			it('has a fixed length', () => {
				let arr1 = comprehensiveData();
				let arr2 = comprehensiveData();

				expect(arr1.length).toBe(arr2.length);
			});
		});
	});

	describe('scraper', () => {
		/**
		 * We have no way of testing without consistent laundry data. When testing, ITaP may be offline,
		 * the testing computer may not have an internet connection, and we need to know what to test for.
		 * We can't set up unit tests without knowing what to expect
		 */
		function setUpSpy(url) {
			spyOn(scraper, 'get').and.returnValue(fs.readFileSync(`../lib/${url}.html`));
		}

		// This isn't testing Redis - use a fake one
		let redis = {
			get: () => null,
			exists: () => 0,
			redis: {
				set: () => null,
				expire: () => null
			}
		};

		describe('scrapeLocations', () => {
			let expected = JSON.parse(fs.readFileSync('../lib/locations.json', 'utf-8'));

			it('can scrape just the locations', () => {
				setUpSpy('just_locations');
				const actual = scraper.scrapeLocations(redis);
				expect(actual).toBe(expected);
			});

			it('can scrape locations with some HTML fluff', () => {
				setUpSpy('locations_html_fluff');
				const actual = scraper.scrapeLocations(redis);
				expect(actual).toBe(expected);
			});

			it('can scrape locations with other option tags', () => {
				setUpSpy('locations_other_option_tags');
				const actual = scraper.scrapeLocations(redis);
				expect(actual).toBe(expected);
			});

			it('can scrape a whole page', () => {
				setUpSpy('whole_page');
				const actual = scraper.scrapeLocations(redis);
				expect(actual).toBe(expected);
			});

			it('returns an empty array when there is an error', () => {
				setUpSpy('error');
				let actual = scraper.scrapeLocations(redis);
				expect(actual).toBe([]);
			});

			it('should be consistent with Purdue\'s API', wrapper(async () => {
				const actual = await scraper.scrapeLocations(redis);
				expect(actual).toBe(expected);
			}));
		});

		describe('getUrlFor', () => {
			beforeEach(() => {
				spyOn(scraper, 'scrapeLocations')
					.and.returnValue(JSON.parse(fs.readFileSync('../lib/locations.json', 'utf-8')));
			});

			it('can return a url for a valid location', wrapper(async () => {
				let url = await scraper.getUrlFor('Earhart Laundry Room', redis);

				let root = 'http://wpvitassuds01.itap.purdue.edu/washalertweb/washalertweb.aspx';
				expect(url).toBe(`${root}?location=a0728ede-60be-4155-8ca9-dcde37ad431d`);
			}));

			it('returns nothing with an invalid location', wrapper(async () => {
				let url = await scraper.getUrlFor('is this the krusty krab?');
				expect(url).toBe('');
			}));
		});

		describe('scrapeAllMachines', () => {
			const expected = JSON.parse(fs.readFileSync('../lib/machines.json', 'utf-8'));

			it('just machines', () => {
				setUpSpy('just_all_machines');
				const actual = scraper.scrapeAllMachines(redis);
				expect(actual).toBe(expected);
			});

			it('machines with fluff', () => {
				setUpSpy('all_machines_fluff');
				const actual = scraper.scrapeAllMachines(redis);
				expect(actual).toBe(expected);
			});

			it('full page', () => {
				setUpSpy('all_machines_full_page');
				const actual = scraper.scrapeAllMachines(redis);
				expect(actual).toBe(expected);
			});

			it('error', () => {
				setUpSpy('error');
				const actual = scraper.scrapeAllMachines(redis);
				expect(actual).toBe(expected);
			});

			it('should be consistent with Purdue\'s API', wrapper(async () => {
				const actual = await scraper.scrapeAllMachines(redis);
				expect(actual).toBe(expected);
			}));
		});

		describe('scrapeMachinesAt', () => {
			const expected = fs.readFileSync('../lib/machines-cary.json');
			const location = 'Cary Quad East Laundry';

			it('just machines', () => {
				setUpSpy('just_machines');
				const actual = scraper.scrapeMachinesAt(location);
				expect(actual).toBe(expected);
			});

			it('machines with fluff', () => {
				setUpSpy('machines_fluff');
				const actual = scraper.scrapeMachinesAt(location);
				expect(actual).toBe(expected);
			});

			it('full page', () => {
				setUpSpy('full_page');
				const actual = scraper.scrapeMachinesAt(location);
				expect(actual).toBe(expected);
			});

			it('error', () => {
				setUpSpy('error');
				const actual = scraper.scrapeMachinesAt(location);
				expect(actual).toBe(expected);
			});

			it('should be consistent with Purdue\'s API', wrapper(async () => {
				const actual = await scraper.scrapeMachinesAt(location);
				expect(actual).toBe(expected);
			}));
		});
	});
});