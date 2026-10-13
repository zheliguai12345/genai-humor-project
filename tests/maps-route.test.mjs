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
test('map queries prefer a precise address/cross street and remove venue and narrative fragments', () => {
  for (const [place, expected] of [
    ["The High Line at 14th Street, looking toward the old meatpackers' cold storage", 'The High Line at 14th Street'],
    ["Faicco's Italian Specialties, 260 Bleecker St", '260 Bleecker St'],
    ['Trinity Church Cemetery, Broadway & Wall St', 'Broadway & Wall St'],
    ['Fraunces Tavern block, 54 Pearl St · corner deli stop', '54 Pearl St'],
    ['Gantry Plaza State Park, Center Blvd & 48th Ave', 'Center Blvd & 48th Ave'],
    ['Conservatory Garden, Central Park · Fifth Ave & 105th St', 'Fifth Ave & 105th St, Central Park'],
    ['Sikder Grocery, 43-03 48th Ave, outside the shop', '43-03 48th Ave'],
    ['Gantry Plaza State Park · 4-44 47th Rd, Queens', '4-44 47th Rd, Queens'],
    ['A-1 Record Shop, 439 E 6th St', '439 E 6th St'],
    ['Neighborhood Cafe, Brooklyn · 24 Bond St', '24 Bond St, Brooklyn'],
    ['49th Avenue Viaduct, 49th Ave and 21st St, Queens', '49th Ave and 21st St, Queens'],
    ['An overlook, 47th Rd, Long Island City', '47th Rd, Long Island City'],
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
  assert.equal(mapQuery('A-1 Record Shop, 439 E 6th St'), '439 E 6th St, New York City');
  assert.equal(mapQuery("Faicco's Italian Specialties, 260 Bleecker St", {preferAddress:false}), "Faicco's Italian Specialties, 260 Bleecker St, New York City");
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
test('Any/A stops with on discard every part of the venue prefix before parsing locations', () => {
  for (const place of ['Any bodega on 48th Ave, Sunnyside',
    'Any bodega, open late on 48th Ave, Sunnyside',
    'A grocery at the corner on 48th Ave, Sunnyside']) {
    assert.equal(mapQuery(place), '48th Ave, Sunnyside, New York City');
  }
  const source = 'A coffee cart in the morning on Broadway & 48th St, Midtown';
  const route = journeyRoute({id:'generic-on',stops:[{position:1,place:source},
    {position:2,place:'Any bodega on 48th Ave, Sunnyside'},
    {position:3,place:'Gantry Plaza State Park, 4-09 47th Rd'}]});
  for (const url of [route.fullUrl,routeEmbedUrl(route.places,'isolated-key')]) {
    const params = new URL(url).searchParams;
    assert.equal(params.get('origin'),'Broadway & 48th St, Midtown, New York City');
    assert.equal(params.get('waypoints'),'48th Ave, Sunnyside, New York City');
    assert.match(url,/origin=[^&]*%26/);
    assert.doesNotMatch(url,/bodega|coffee|morning|corner/);
  }
  assert.equal(source,'A coffee cart in the morning on Broadway & 48th St, Midtown');
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
test('Friendly route uses the searchable cross street instead of an unrecognized viaduct name', () => {
  const stops=[{position:1,place:'46th St–Bliss St Station, Roosevelt Ave & 46th St'},
    {position:2,place:'Any bodega on 48th Ave, Sunnyside'},
    {position:3,place:'49th Avenue Viaduct, 49th Ave & 21st St'},
    {position:4,place:'Gantry Plaza State Park, 4-09 47th Rd'}];
  const route=journeyRoute({id:'6403573b-eb79-4d9b-915a-fc188ca15133',stops});
  assert.equal(route.places.length,4);
  assert.equal(route.places[2],'49th Ave & 21st St, Queens, New York City');
  for(const url of [route.fullUrl,routeEmbedUrl(route.places,'isolated-key')]) {
    assert.equal(new URL(url).searchParams.get('origin'),'Queens Blvd & 46th St, Queens, New York City');
    assert.equal(new URL(url).searchParams.get('waypoints'),'48th Ave, Sunnyside, New York City|49th Ave & 21st St, Queens, New York City');
    assert.match(url,/waypoints=[^&]*49th\+Ave\+%26\+21st\+St/);
    assert.doesNotMatch(url,/Viaduct/);
  }
  assert.equal(stops[0].place,'46th St–Bliss St Station, Roosevelt Ave & 46th St');
  assert.equal(stops[2].place,'49th Avenue Viaduct, 49th Ave & 21st St');
});
