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
  ]) assert.equal(mapQuery(place), `${expected}, New York, NY`);
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
test('walking URLs preserve ordered specific stops, filter generic instructions, and encode waypoints', () => {
  const route = journeyRoute(journey);
  assert.deepEqual(route.places, ['Greene Street, New York, NY', 'Columbus Park, New York, NY', 'Stone Street, New York, NY']);
  const full = new URL(route.fullUrl), embed = new URL(routeEmbedUrl(route.places, 'isolated-key'));
  assert.equal(full.searchParams.get('origin'), route.places[0]);
  assert.equal(full.searchParams.get('destination'), route.places[2]);
  assert.equal(full.searchParams.get('waypoints'), route.places[1]);
  assert.equal(full.searchParams.get('travelmode'), 'walking');
  assert.equal(embed.pathname, '/maps/embed/v1/directions'); assert.equal(embed.searchParams.get('mode'), 'walking');
  assert.equal(embed.searchParams.get('origin'), full.searchParams.get('origin'));
  for (const generic of ['Look up, anywhere north of Canal St', 'A record shop', 'The nearest cafe', 'New York', 'Veselka or a successor', 'Park / diner']) assert.equal(specificMapPlace(generic), false);
});
test('editorial map anchors resolve ambient seed stops without rewriting their stored copy', () => {
  const seed = { id: 'e15e0000-0000-4000-8000-000000000001', stops: [
    { position: 1, place: 'Greene Street, between Canal & Grand St' },
    { position: 2, place: 'Look up, anywhere north of Canal St' },
    { position: 5, place: 'Columbus Park, Mulberry & Bayard St' },
  ] };
  assert.equal(journeyRoute(seed).places[1], 'Greene Street & Grand Street, New York, NY');
  assert.equal(seed.stops[1].place, 'Look up, anywhere north of Canal St');
  assert.equal(routeEmbedUrl(journeyRoute(seed).places, undefined), null);
  assert.equal(routeEmbedUrl(['Greene Street'], 'isolated-key'), null);
});
test('missing embed key keeps the full route link and renders no iframe', async () => {
  const { RouteMap } = await moduleLoader('app/components/route-map.tsx', { 'react/jsx-runtime': jsx }, {});
  const html = renderToStaticMarkup(React.createElement(RouteMap, { journey }));
  assert.match(html, /Open full route in Google Maps/); assert.doesNotMatch(html, /<iframe/);
});
