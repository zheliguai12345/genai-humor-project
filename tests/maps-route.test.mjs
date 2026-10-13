import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { journeyRoute, mapQuery, routeEmbedUrl, specificMapPlace } from '../utils/journeys/maps.ts';
import { moduleLoader } from './helpers/module-loader.mjs';

const journey = { id: 'local-test', title: 'A short walk', stops: [
  { position: 1, place: 'Greene Street' }, { position: 2, place: 'Any blue mailbox on your way south' },
  { position: 3, place: 'Columbus Park' }, { position: 4, place: 'Stone Street' },
] };
test('map queries retain all address/cross-street segments and remove narrative fragments', () => {
  for (const [place, expected] of [
    ["The High Line at 14th Street, looking toward the old meatpackers' cold storage", 'The High Line at 14th Street'],
    ["Faicco's Italian Specialties, 260 Bleecker St", "Faicco's Italian Specialties, 260 Bleecker St"],
    ['Trinity Church Cemetery, Broadway & Wall St', 'Trinity Church Cemetery, Broadway & Wall St'],
    ['Fraunces Tavern block, 54 Pearl St · corner deli stop', 'Fraunces Tavern, 54 Pearl St'],
    ['Gantry Plaza State Park, Center Blvd & 48th Ave', 'Gantry Plaza State Park, Center Blvd & 48th Ave'],
    ['Conservatory Garden, Central Park · Fifth Ave & 105th St', 'Conservatory Garden, Central Park, Fifth Ave & 105th St'],
    ['Sikder Grocery, 43-03 48th Ave, outside the shop', 'Sikder Grocery, 43-03 48th Ave'],
    ['Columbus Park', 'Columbus Park'],
  ]) assert.equal(mapQuery(place), `${expected}, New York City`);
});
test('both route URLs use clean queries while the source place copy stays intact', () => {
  const original = "The High Line at 14th Street, looking toward the old meatpackers' cold storage";
  const route = journeyRoute({ id: 'isolated', stops: [{ position: 1, place: original }, { position: 2, place: "Faicco's Italian Specialties, 260 Bleecker St" }] });
  const full = new URL(route.fullUrl), embed = new URL(routeEmbedUrl(route.places, 'isolated-key'));
  assert.equal(full.searchParams.get('origin'), mapQuery(original));
  assert.equal(embed.searchParams.get('origin'), full.searchParams.get('origin'));
  assert.equal(embed.searchParams.get('destination'), mapQuery("Faicco's Italian Specialties, 260 Bleecker St"));
  assert.equal(original, "The High Line at 14th Street, looking toward the old meatpackers' cold storage");
});
test('Any/A category stops map only to the street and neighborhood, including in both route URLs', () => {
  for (const [place, expected] of [
    ['Any bodega on 48th Ave, Sunnyside', '48th Ave, Sunnyside'],
    ['A coffee cart on Broadway, Upper West Side', 'Broadway, Upper West Side'],
    ['A deli at 54 Pearl St, Financial District · corner stop', '54 Pearl St, Financial District'],
    ['A coffee cart, Fifth Ave & 59th St', 'Fifth Ave & 59th St'],
  ]) assert.equal(mapQuery(place), `${expected}, New York City`);
  assert.equal(mapQuery('A-1 Record Shop, 439 E 6th St'), 'A-1 Record Shop, 439 E 6th St, New York City');
  const stops = [{ position: 1, place: 'Any bodega on 48th Ave, Sunnyside' },
    { position: 2, place: 'A coffee cart on Broadway, Upper West Side' }];
  const route = journeyRoute({ id: 'category-test', stops });
  assert.equal(route.places.length, 2);
  for (const url of [route.fullUrl, routeEmbedUrl(route.places, 'isolated-key')]) {
    const parameters = new URL(url).searchParams;
    assert.equal(parameters.get('origin'), '48th Ave, Sunnyside, New York City');
    assert.equal(parameters.get('destination'), 'Broadway, Upper West Side, New York City');
  }
  assert.equal(stops[0].place, 'Any bodega on 48th Ave, Sunnyside');
});
test('walking URLs preserve ordered specific stops, filter generic instructions, and encode waypoints', () => {
  const route = journeyRoute(journey);
  assert.deepEqual(route.places, ['Greene Street, New York City', 'Columbus Park, New York City', 'Stone Street, New York City']);
  const full = new URL(route.fullUrl), embed = new URL(routeEmbedUrl(route.places, 'isolated-key'));
  assert.equal(full.searchParams.get('origin'), route.places[0]);
  assert.equal(full.searchParams.get('destination'), route.places[2]);
  assert.equal(full.searchParams.get('waypoints'), route.places[1]);
  assert.equal(full.searchParams.get('travelmode'), 'walking');
  assert.equal(embed.pathname, '/maps/embed/v1/directions'); assert.equal(embed.searchParams.get('mode'), 'walking');
  assert.equal(embed.searchParams.get('origin'), full.searchParams.get('origin'));
  for (const generic of ['Look up, anywhere north of Canal St', 'A record shop', 'The nearest cafe', 'New York', 'Veselka or a successor', 'Park / diner']) assert.equal(specificMapPlace(generic), false);
});
test('ampersands in every route field are encoded once rather than interpreted as parameters', () => {
  const places=['Broadway & Wall St, New York City','Greene St & Grand St, New York City','Fifth Ave & 59th St, New York City'];
  const full=journeyRoute({id:'encoding-test',stops:places.map((place,index)=>({position:index+1,place:place.replace(', New York City','')}))});
  for(const url of [full.fullUrl,routeEmbedUrl(places,'isolated-key')]) {
    assert.match(url,/origin=[^&]*%26/);assert.match(url,/destination=[^&]*%26/);assert.match(url,/waypoints=[^&]*%26/);
    assert.doesNotMatch(url,/%2526/);
    const params=new URL(url).searchParams;
    assert.equal(params.get('origin'),places[0]);assert.equal(params.get('waypoints'),places[1]);assert.equal(params.get('destination'),places[2]);
  }
});
test('editorial map anchors resolve ambient seed stops without rewriting their stored copy', () => {
  const seed = { id: 'e15e0000-0000-4000-8000-000000000001', stops: [
    { position: 1, place: 'Greene Street, between Canal & Grand St' },
    { position: 2, place: 'Look up, anywhere north of Canal St' },
    { position: 5, place: 'Columbus Park, Mulberry & Bayard St' },
  ] };
  assert.equal(journeyRoute(seed).places[1], 'Greene Street & Grand Street, New York City');
  assert.equal(seed.stops[1].place, 'Look up, anywhere north of Canal St');
  assert.equal(routeEmbedUrl(journeyRoute(seed).places, undefined), null);
  assert.equal(routeEmbedUrl(['Greene Street'], 'isolated-key'), null);
});
test('missing embed key keeps the full route link and renders no iframe', async () => {
  const { RouteMap } = await moduleLoader('app/components/route-map.tsx', { 'react/jsx-runtime': jsx }, {});
  const html = renderToStaticMarkup(React.createElement(RouteMap, { journey }));
  assert.match(html, /Open full route in Google Maps/); assert.doesNotMatch(html, /<iframe/);
});
