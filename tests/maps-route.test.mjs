import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { journeyRoute, routeEmbedUrl, specificMapPlace } from '../utils/journeys/maps.ts';
import { moduleLoader } from './helpers/module-loader.mjs';

const journey = { id: 'local-test', title: 'A short walk', stops: [
  { position: 1, place: 'Greene Street' }, { position: 2, place: 'Any blue mailbox on your way south' },
  { position: 3, place: 'Columbus Park' }, { position: 4, place: 'Stone Street' },
] };
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
