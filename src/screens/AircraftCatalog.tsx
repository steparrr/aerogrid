import { useState, useMemo, useCallback } from "react";
import { useGame } from "../game/gameContext";
import { aircraftModelById } from "../data/indexes";

// ─── DATASET ─────────────────────────────────────────────────────────────────
interface CatalogAircraft {
  id: string; mfr: string; family: string; type: string; role: string;
  entry: number; pax: number; range: number; speed: number; fuel_kgh: number;
  list_m: number; lease_k: number; mtow: number; engines: number;
  co2_rpk: number | null; cask_usc: number | null; cost_seat_hr: number | null;
  util_day_h: number; pilots: number; dim_l_m?: number; dim_ws_m?: number;
  dim_h_m?: number; notes: string;
}

const AIRCRAFT_DATA: CatalogAircraft[] = [
  { id:"A220-100",    mfr:"AIRBUS",    family:"A220",  type:"NARROWBODY", role:"PAX",   entry:2016, pax:108,  range:5740,  speed:871, fuel_kgh:1980,  list_m:91.5,  lease_k:180, mtow:63.1,  engines:2, co2_rpk:68,  cask_usc:5.2, cost_seat_hr:22, util_day_h:10.5, pilots:11, notes:"Ex CS100 Bombardier" },
  { id:"A220-300",    mfr:"AIRBUS",    family:"A220",  type:"NARROWBODY", role:"PAX",   entry:2016, pax:145,  range:6300,  speed:871, fuel_kgh:2250,  list_m:107.0, lease_k:220, mtow:70.9,  engines:2, co2_rpk:63,  cask_usc:4.8, cost_seat_hr:19, util_day_h:10.5, pilots:11, notes:"Workhouse short/medium" },
  { id:"A319ceo",     mfr:"AIRBUS",    family:"A320",  type:"NARROWBODY", role:"PAX",   entry:1996, pax:156,  range:6850,  speed:833, fuel_kgh:2490,  list_m:101.5, lease_k:230, mtow:75.5,  engines:2, co2_rpk:78,  cask_usc:6.1, cost_seat_hr:24, util_day_h:10.0, pilots:11, notes:"Mercato usato liquido" },
  { id:"A320ceo",     mfr:"AIRBUS",    family:"A320",  type:"NARROWBODY", role:"PAX",   entry:1988, pax:180,  range:6300,  speed:833, fuel_kgh:2700,  list_m:110.0, lease_k:280, mtow:77.0,  engines:2, co2_rpk:75,  cask_usc:5.5, cost_seat_hr:21, util_day_h:10.0, pilots:11, notes:"L'aereo più ordinato della storia" },
  { id:"A321ceo",     mfr:"AIRBUS",    family:"A320",  type:"NARROWBODY", role:"PAX",   entry:1994, pax:220,  range:5930,  speed:833, fuel_kgh:3150,  list_m:130.5, lease_k:320, mtow:93.5,  engines:2, co2_rpk:71,  cask_usc:5.0, cost_seat_hr:19, util_day_h:10.0, pilots:11, notes:"" },
  { id:"A319neo",     mfr:"AIRBUS",    family:"A320",  type:"NARROWBODY", role:"PAX",   entry:2018, pax:160,  range:7750,  speed:833, fuel_kgh:2060,  list_m:111.0, lease_k:270, mtow:75.5,  engines:2, co2_rpk:65,  cask_usc:5.3, cost_seat_hr:21, util_day_h:10.5, pilots:11, notes:"" },
  { id:"A320neo",     mfr:"AIRBUS",    family:"A320",  type:"NARROWBODY", role:"PAX",   entry:2016, pax:194,  range:6300,  speed:833, fuel_kgh:2350,  list_m:122.6, lease_k:340, mtow:79.0,  engines:2, co2_rpk:61,  cask_usc:4.5, cost_seat_hr:17, util_day_h:11.0, pilots:11, notes:"Best-seller narrowbody" },
  { id:"A321neo",     mfr:"AIRBUS",    family:"A320",  type:"NARROWBODY", role:"PAX",   entry:2017, pax:244,  range:7400,  speed:833, fuel_kgh:2700,  list_m:149.1, lease_k:400, mtow:97.0,  engines:2, co2_rpk:64,  cask_usc:4.2, cost_seat_hr:16, util_day_h:11.0, pilots:11, notes:"CASM più basso tra i narrowbody" },
  { id:"A321LR",      mfr:"AIRBUS",    family:"A320",  type:"NARROWBODY", role:"PAX",   entry:2018, pax:206,  range:7700,  speed:833, fuel_kgh:2680,  list_m:149.1, lease_k:410, mtow:97.0,  engines:2, co2_rpk:65,  cask_usc:4.4, cost_seat_hr:17, util_day_h:10.5, pilots:11, dim_l_m:44.5, dim_ws_m:35.8, dim_h_m:11.8, notes:"Precursore XLR" },
  { id:"A321XLR",     mfr:"AIRBUS",    family:"A320",  type:"NARROWBODY", role:"PAX",   entry:2024, pax:244,  range:8700,  speed:833, fuel_kgh:2750,  list_m:157.0, lease_k:430, mtow:101.0, engines:2, co2_rpk:62,  cask_usc:4.1, cost_seat_hr:16, util_day_h:11.0, pilots:11, dim_l_m:44.5, dim_ws_m:35.8, dim_h_m:11.8, notes:"Game-changer rotte medie senza hub" },
  { id:"B737-300",    mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:1984, pax:149,  range:4440,  speed:793, fuel_kgh:2680,  list_m:52.0,  lease_k:80,  mtow:62.8,  engines:2, co2_rpk:90,  cask_usc:7.2, cost_seat_hr:28, util_day_h:8.5,  pilots:11, notes:"Fuori produzione" },
  { id:"B737-400",    mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:1988, pax:188,  range:5000,  speed:793, fuel_kgh:2850,  list_m:60.0,  lease_k:90,  mtow:68.0,  engines:2, co2_rpk:86,  cask_usc:6.8, cost_seat_hr:26, util_day_h:8.5,  pilots:11, notes:"" },
  { id:"B737-500",    mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:1990, pax:132,  range:5200,  speed:793, fuel_kgh:2500,  list_m:45.0,  lease_k:75,  mtow:60.6,  engines:2, co2_rpk:88,  cask_usc:7.0, cost_seat_hr:27, util_day_h:8.5,  pilots:11, notes:"" },
  { id:"B737-600",    mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:1998, pax:130,  range:5648,  speed:833, fuel_kgh:2400,  list_m:57.6,  lease_k:120, mtow:65.1,  engines:2, co2_rpk:83,  cask_usc:6.5, cost_seat_hr:26, util_day_h:9.0,  pilots:11, notes:"Pochissimi ordinati" },
  { id:"B737-700",    mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:1997, pax:149,  range:6370,  speed:833, fuel_kgh:2500,  list_m:89.1,  lease_k:170, mtow:70.1,  engines:2, co2_rpk:80,  cask_usc:6.2, cost_seat_hr:25, util_day_h:9.0,  pilots:11, notes:"" },
  { id:"B737-800",    mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:1998, pax:189,  range:5765,  speed:842, fuel_kgh:2800,  list_m:106.1, lease_k:290, mtow:79.0,  engines:2, co2_rpk:74,  cask_usc:5.4, cost_seat_hr:20, util_day_h:10.5, pilots:11, notes:"Narrowbody più diffuso al mondo" },
  { id:"B737-900",    mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:2001, pax:220,  range:5083,  speed:842, fuel_kgh:3000,  list_m:99.0,  lease_k:230, mtow:85.1,  engines:2, co2_rpk:72,  cask_usc:5.2, cost_seat_hr:19, util_day_h:10.5, pilots:11, notes:"" },
  { id:"B737-900ER",  mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:2007, pax:220,  range:5925,  speed:842, fuel_kgh:2980,  list_m:106.0, lease_k:250, mtow:85.1,  engines:2, co2_rpk:71,  cask_usc:5.1, cost_seat_hr:19, util_day_h:10.5, pilots:11, notes:"" },
  { id:"B737-MAX7",   mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:2021, pax:153,  range:7130,  speed:839, fuel_kgh:2200,  list_m:99.7,  lease_k:200, mtow:80.3,  engines:2, co2_rpk:68,  cask_usc:5.5, cost_seat_hr:22, util_day_h:10.5, pilots:11, dim_l_m:35.6, dim_ws_m:35.9, dim_h_m:12.3, notes:"" },
  { id:"B737-MAX8",   mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:2017, pax:210,  range:6570,  speed:839, fuel_kgh:2500,  list_m:121.6, lease_k:340, mtow:82.2,  engines:2, co2_rpk:63,  cask_usc:4.6, cost_seat_hr:18, util_day_h:11.0, pilots:11, notes:"Rientrato 2020 post-grounding" },
  { id:"B737-MAX9",   mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:2018, pax:220,  range:6570,  speed:839, fuel_kgh:2600,  list_m:135.8, lease_k:360, mtow:88.3,  engines:2, co2_rpk:62,  cask_usc:4.4, cost_seat_hr:17, util_day_h:11.0, pilots:11, dim_l_m:42.1, dim_ws_m:35.9, dim_h_m:12.3, notes:"" },
  { id:"B737-MAX10",  mfr:"BOEING",    family:"B737",  type:"NARROWBODY", role:"PAX",   entry:2023, pax:230,  range:6110,  speed:839, fuel_kgh:2650,  list_m:138.3, lease_k:380, mtow:89.8,  engines:2, co2_rpk:61,  cask_usc:4.3, cost_seat_hr:17, util_day_h:11.0, pilots:11, dim_l_m:43.8, dim_ws_m:35.9, dim_h_m:12.3, notes:"Versione più lunga MAX" },
  { id:"B757-200",    mfr:"BOEING",    family:"B757",  type:"NARROWBODY", role:"PAX",   entry:1983, pax:239,  range:7250,  speed:855, fuel_kgh:3650,  list_m:150.0, lease_k:200, mtow:115.7, engines:2, co2_rpk:78,  cask_usc:5.8, cost_seat_hr:22, util_day_h:9.5,  pilots:11, notes:"Fuori prod., ancora operativo" },
  { id:"B757-300",    mfr:"BOEING",    family:"B757",  type:"NARROWBODY", role:"PAX",   entry:1999, pax:295,  range:6295,  speed:855, fuel_kgh:4000,  list_m:165.0, lease_k:230, mtow:123.8, engines:2, co2_rpk:74,  cask_usc:5.4, cost_seat_hr:21, util_day_h:9.5,  pilots:11, notes:"" },
  { id:"B757-200F",   mfr:"BOEING",    family:"B757",  type:"NARROWBODY", role:"CARGO", entry:1987, pax:0,    range:7200,  speed:855, fuel_kgh:3600,  list_m:145.0, lease_k:185, mtow:123.6, engines:2, co2_rpk:null,cask_usc:null,cost_seat_hr:null,util_day_h:10.0, pilots:11, notes:"FedEx, DHL" },
  { id:"MD-80",       mfr:"MCDONNELL", family:"MD-80", type:"NARROWBODY", role:"PAX",   entry:1980, pax:155,  range:4635,  speed:811, fuel_kgh:3000,  list_m:45.0,  lease_k:60,  mtow:67.8,  engines:2, co2_rpk:95,  cask_usc:7.5, cost_seat_hr:30, util_day_h:8.0,  pilots:11, notes:"T-tail, pensionamento in corso" },
  { id:"MD-90",       mfr:"MCDONNELL", family:"MD-90", type:"NARROWBODY", role:"PAX",   entry:1995, pax:172,  range:3858,  speed:811, fuel_kgh:2750,  list_m:58.0,  lease_k:80,  mtow:70.8,  engines:2, co2_rpk:88,  cask_usc:7.0, cost_seat_hr:27, util_day_h:8.5,  pilots:11, notes:"" },
  { id:"MC-21-300",   mfr:"IRKUT",     family:"MC-21", type:"NARROWBODY", role:"PAX",   entry:2022, pax:211,  range:6000,  speed:870, fuel_kgh:2380,  list_m:96.0,  lease_k:260, mtow:79.3,  engines:2, co2_rpk:64,  cask_usc:4.7, cost_seat_hr:18, util_day_h:10.0, pilots:11, dim_l_m:42.2, dim_ws_m:35.9, dim_h_m:11.5, notes:"Russo, servizio limitato (sanzioni)" },
  { id:"C919",        mfr:"COMAC",     family:"C919",  type:"NARROWBODY", role:"PAX",   entry:2023, pax:192,  range:5555,  speed:834, fuel_kgh:2400,  list_m:99.0,  lease_k:250, mtow:77.3,  engines:2, co2_rpk:65,  cask_usc:4.8, cost_seat_hr:19, util_day_h:10.0, pilots:11, dim_l_m:38.9, dim_ws_m:35.8, dim_h_m:11.95, notes:"Solo Cina" },
  { id:"ARJ21",       mfr:"COMAC",     family:"ARJ21", type:"REGIONAL",   role:"PAX",   entry:2016, pax:90,   range:3700,  speed:820, fuel_kgh:1650,  list_m:31.0,  lease_k:95,  mtow:40.5,  engines:2, co2_rpk:82,  cask_usc:6.8, cost_seat_hr:26, util_day_h:9.0,  pilots:11, dim_l_m:32.9, dim_ws_m:28.7, dim_h_m:10.4, notes:"" },
  { id:"E170",        mfr:"EMBRAER",   family:"E-Jet", type:"REGIONAL",   role:"PAX",   entry:2004, pax:80,   range:3735,  speed:870, fuel_kgh:1530,  list_m:39.0,  lease_k:110, mtow:37.2,  engines:2, co2_rpk:84,  cask_usc:7.8, cost_seat_hr:30, util_day_h:9.0,  pilots:11, notes:"" },
  { id:"E175",        mfr:"EMBRAER",   family:"E-Jet", type:"REGIONAL",   role:"PAX",   entry:2004, pax:88,   range:4074,  speed:870, fuel_kgh:1600,  list_m:46.2,  lease_k:130, mtow:40.4,  engines:2, co2_rpk:81,  cask_usc:7.2, cost_seat_hr:28, util_day_h:9.5,  pilots:11, notes:"Molto usato da feeder USA (scope clause)" },
  { id:"E190",        mfr:"EMBRAER",   family:"E-Jet", type:"REGIONAL",   role:"PAX",   entry:2005, pax:114,  range:4537,  speed:870, fuel_kgh:1850,  list_m:53.4,  lease_k:155, mtow:51.8,  engines:2, co2_rpk:76,  cask_usc:6.4, cost_seat_hr:24, util_day_h:9.5,  pilots:11, notes:"" },
  { id:"E195",        mfr:"EMBRAER",   family:"E-Jet", type:"REGIONAL",   role:"PAX",   entry:2006, pax:124,  range:4260,  speed:870, fuel_kgh:1950,  list_m:56.0,  lease_k:165, mtow:52.3,  engines:2, co2_rpk:74,  cask_usc:6.1, cost_seat_hr:23, util_day_h:9.5,  pilots:11, notes:"" },
  { id:"E175-E2",     mfr:"EMBRAER",   family:"E-Jet", type:"REGIONAL",   role:"PAX",   entry:2021, pax:88,   range:3735,  speed:870, fuel_kgh:1380,  list_m:57.0,  lease_k:145, mtow:44.8,  engines:2, co2_rpk:70,  cask_usc:6.5, cost_seat_hr:25, util_day_h:9.5,  pilots:11, dim_l_m:34.9, dim_ws_m:28.7, dim_h_m:10.7, notes:"Scope clause bloccata" },
  { id:"E190-E2",     mfr:"EMBRAER",   family:"E-Jet", type:"REGIONAL",   role:"PAX",   entry:2018, pax:114,  range:5278,  speed:870, fuel_kgh:1620,  list_m:60.5,  lease_k:175, mtow:56.4,  engines:2, co2_rpk:66,  cask_usc:5.8, cost_seat_hr:22, util_day_h:10.0, pilots:11, dim_l_m:36.2, dim_ws_m:28.7, dim_h_m:10.6, notes:"" },
  { id:"E195-E2",     mfr:"EMBRAER",   family:"E-Jet", type:"REGIONAL",   role:"PAX",   entry:2019, pax:146,  range:4800,  speed:870, fuel_kgh:1900,  list_m:72.0,  lease_k:200, mtow:61.5,  engines:2, co2_rpk:63,  cask_usc:5.2, cost_seat_hr:20, util_day_h:10.0, pilots:11, dim_l_m:41.5, dim_ws_m:35.1, dim_h_m:11.5, notes:"Competitor diretto A220-300" },
  { id:"CRJ-700",     mfr:"BOMBARDIER",family:"CRJ",   type:"REGIONAL",   role:"PAX",   entry:2001, pax:78,   range:3045,  speed:870, fuel_kgh:1450,  list_m:36.5,  lease_k:95,  mtow:33.2,  engines:2, co2_rpk:90,  cask_usc:8.2, cost_seat_hr:32, util_day_h:8.5,  pilots:11, notes:"" },
  { id:"CRJ-900",     mfr:"BOMBARDIER",family:"CRJ",   type:"REGIONAL",   role:"PAX",   entry:2003, pax:90,   range:2876,  speed:870, fuel_kgh:1580,  list_m:46.0,  lease_k:115, mtow:38.3,  engines:2, co2_rpk:86,  cask_usc:7.8, cost_seat_hr:30, util_day_h:8.5,  pilots:11, notes:"" },
  { id:"CRJ-1000",    mfr:"BOMBARDIER",family:"CRJ",   type:"REGIONAL",   role:"PAX",   entry:2011, pax:104,  range:3004,  speed:870, fuel_kgh:1720,  list_m:52.0,  lease_k:130, mtow:41.6,  engines:2, co2_rpk:83,  cask_usc:7.4, cost_seat_hr:28, util_day_h:8.5,  pilots:11, notes:"" },
  { id:"ATR42-600",   mfr:"ATR",       family:"ATR42", type:"TURBOPROP",  role:"PAX",   entry:2009, pax:50,   range:1326,  speed:556, fuel_kgh:600,   list_m:26.0,  lease_k:80,  mtow:18.6,  engines:2, co2_rpk:55,  cask_usc:9.5, cost_seat_hr:37, util_day_h:7.0,  pilots:11, notes:"Turboelica, piste corte" },
  { id:"ATR72-600",   mfr:"ATR",       family:"ATR72", type:"TURBOPROP",  role:"PAX",   entry:2009, pax:78,   range:1528,  speed:510, fuel_kgh:790,   list_m:31.8,  lease_k:100, mtow:23.0,  engines:2, co2_rpk:52,  cask_usc:8.8, cost_seat_hr:34, util_day_h:7.5,  pilots:11, notes:"Domina mercato isole/remoti" },
  { id:"A300-600",    mfr:"AIRBUS",    family:"A300",  type:"WIDEBODY",   role:"PAX",   entry:1984, pax:361,  range:7700,  speed:833, fuel_kgh:6400,  list_m:168.0, lease_k:350, mtow:170.5, engines:2, co2_rpk:100, cask_usc:8.0, cost_seat_hr:30, util_day_h:11.0, pilots:26, notes:"Fuori prod. 2007, cargo ancora attivo" },
  { id:"A310-300",    mfr:"AIRBUS",    family:"A300",  type:"WIDEBODY",   role:"PAX",   entry:1985, pax:280,  range:9600,  speed:856, fuel_kgh:5800,  list_m:145.0, lease_k:280, mtow:164.0, engines:2, co2_rpk:105, cask_usc:8.5, cost_seat_hr:33, util_day_h:11.0, pilots:26, notes:"Molti convertiti cargo" },
  { id:"A330-200",    mfr:"AIRBUS",    family:"A330",  type:"WIDEBODY",   role:"PAX",   entry:1998, pax:406,  range:13400, speed:871, fuel_kgh:6200,  list_m:238.5, lease_k:550, mtow:242.0, engines:2, co2_rpk:92,  cask_usc:7.8, cost_seat_hr:35, util_day_h:13.0, pilots:26, notes:"" },
  { id:"A330-300",    mfr:"AIRBUS",    family:"A330",  type:"WIDEBODY",   role:"PAX",   entry:1994, pax:440,  range:11750, speed:871, fuel_kgh:6700,  list_m:264.2, lease_k:600, mtow:242.0, engines:2, co2_rpk:86,  cask_usc:7.0, cost_seat_hr:21, util_day_h:13.0, pilots:26, notes:"" },
  { id:"A330-800neo", mfr:"AIRBUS",    family:"A330",  type:"WIDEBODY",   role:"PAX",   entry:2020, pax:406,  range:15094, speed:912, fuel_kgh:5500,  list_m:259.9, lease_k:620, mtow:251.0, engines:2, co2_rpk:78,  cask_usc:6.2, cost_seat_hr:24, util_day_h:14.0, pilots:26, dim_l_m:63.7, dim_ws_m:64.0, dim_h_m:17.4, notes:"Ultra long range" },
  { id:"A330-900neo", mfr:"AIRBUS",    family:"A330",  type:"WIDEBODY",   role:"PAX",   entry:2018, pax:460,  range:13334, speed:912, fuel_kgh:6000,  list_m:296.4, lease_k:700, mtow:251.0, engines:2, co2_rpk:80,  cask_usc:6.5, cost_seat_hr:22, util_day_h:13.5, pilots:26, dim_l_m:63.7, dim_ws_m:64.0, dim_h_m:17.4, notes:"-14% fuel vs CEO" },
  { id:"A330-200F",   mfr:"AIRBUS",    family:"A330",  type:"WIDEBODY",   role:"CARGO", entry:2010, pax:0,    range:7400,  speed:871, fuel_kgh:6300,  list_m:238.5, lease_k:500, mtow:233.0, engines:2, co2_rpk:null,cask_usc:null,cost_seat_hr:null,util_day_h:12.5, pilots:26, notes:"Freighter dedicato" },
  { id:"A340-300",    mfr:"AIRBUS",    family:"A340",  type:"WIDEBODY",   role:"PAX",   entry:1993, pax:440,  range:13700, speed:880, fuel_kgh:8700,  list_m:224.0, lease_k:380, mtow:276.5, engines:4, co2_rpk:110, cask_usc:9.0, cost_seat_hr:35, util_day_h:13.0, pilots:26, notes:"4 motori, uscito per 777/787" },
  { id:"A340-500",    mfr:"AIRBUS",    family:"A340",  type:"WIDEBODY",   role:"PAX",   entry:2003, pax:375,  range:16670, speed:880, fuel_kgh:9300,  list_m:291.0, lease_k:440, mtow:372.0, engines:4, co2_rpk:116, cask_usc:9.8, cost_seat_hr:38, util_day_h:14.0, pilots:26, notes:"Ultra long, pochi esemplari" },
  { id:"A340-600",    mfr:"AIRBUS",    family:"A340",  type:"WIDEBODY",   role:"PAX",   entry:2002, pax:475,  range:14600, speed:880, fuel_kgh:9600,  list_m:330.0, lease_k:450, mtow:368.0, engines:4, co2_rpk:112, cask_usc:9.2, cost_seat_hr:36, util_day_h:13.5, pilots:26, notes:"4 motori" },
  { id:"A350-900",    mfr:"AIRBUS",    family:"A350",  type:"WIDEBODY",   role:"PAX",   entry:2015, pax:440,  range:15000, speed:910, fuel_kgh:6800,  list_m:317.4, lease_k:1050,mtow:280.0, engines:2, co2_rpk:76,  cask_usc:6.0, cost_seat_hr:23, util_day_h:15.0, pilots:26, notes:"Best-seller long haul" },
  { id:"A350-1000",   mfr:"AIRBUS",    family:"A350",  type:"WIDEBODY",   role:"PAX",   entry:2018, pax:480,  range:16100, speed:910, fuel_kgh:7500,  list_m:366.5, lease_k:1200,mtow:316.0, engines:2, co2_rpk:74,  cask_usc:5.8, cost_seat_hr:22, util_day_h:15.0, pilots:26, notes:"" },
  { id:"A350-900ULR", mfr:"AIRBUS",    family:"A350",  type:"WIDEBODY",   role:"PAX",   entry:2018, pax:161,  range:18000, speed:910, fuel_kgh:6800,  list_m:317.4, lease_k:1100,mtow:280.0, engines:2, co2_rpk:96,  cask_usc:8.5, cost_seat_hr:42, util_day_h:17.0, pilots:26, dim_l_m:67.0, dim_ws_m:64.75,dim_h_m:17.05, notes:"Singapore-Newark 19h" },
  { id:"A350F",       mfr:"AIRBUS",    family:"A350",  type:"WIDEBODY",   role:"CARGO", entry:2026, pax:0,    range:9260,  speed:910, fuel_kgh:7000,  list_m:380.0, lease_k:1150,mtow:316.0, engines:2, co2_rpk:null,cask_usc:null,cost_seat_hr:null,util_day_h:14.0, pilots:26, dim_l_m:70.6, dim_ws_m:64.8, dim_h_m:17.1, notes:"Entra in servizio 2026" },
  { id:"A380-800",    mfr:"AIRBUS",    family:"A380",  type:"WIDEBODY",   role:"PAX",   entry:2007, pax:853,  range:15200, speed:903, fuel_kgh:12700, list_m:432.0, lease_k:1200,mtow:575.0, engines:4, co2_rpk:75,  cask_usc:4.8, cost_seat_hr:18, util_day_h:15.5, pilots:26, notes:"Doppio ponte. Prod. chiusa 2021." },
  { id:"B767-200ER",  mfr:"BOEING",    family:"B767",  type:"WIDEBODY",   role:"PAX",   entry:1984, pax:224,  range:12200, speed:851, fuel_kgh:5200,  list_m:144.0, lease_k:300, mtow:179.2, engines:2, co2_rpk:115, cask_usc:9.2, cost_seat_hr:36, util_day_h:11.0, pilots:26, notes:"" },
  { id:"B767-300ER",  mfr:"BOEING",    family:"B767",  type:"WIDEBODY",   role:"PAX",   entry:1988, pax:350,  range:11093, speed:851, fuel_kgh:5800,  list_m:199.0, lease_k:400, mtow:187.0, engines:2, co2_rpk:98,  cask_usc:7.8, cost_seat_hr:30, util_day_h:12.0, pilots:26, notes:"Backbone transatlantici anni 90-2000" },
  { id:"B767-400ER",  mfr:"BOEING",    family:"B767",  type:"WIDEBODY",   role:"PAX",   entry:2000, pax:375,  range:10450, speed:851, fuel_kgh:6100,  list_m:211.0, lease_k:420, mtow:204.1, engines:2, co2_rpk:95,  cask_usc:7.5, cost_seat_hr:29, util_day_h:12.0, pilots:26, notes:"" },
  { id:"B767-300F",   mfr:"BOEING",    family:"B767",  type:"WIDEBODY",   role:"CARGO", entry:1995, pax:0,    range:6025,  speed:851, fuel_kgh:5700,  list_m:196.0, lease_k:380, mtow:186.9, engines:2, co2_rpk:null,cask_usc:null,cost_seat_hr:null,util_day_h:12.5, pilots:26, notes:"UPS, Amazon Air" },
  { id:"B777-200",    mfr:"BOEING",    family:"B777",  type:"WIDEBODY",   role:"PAX",   entry:1995, pax:440,  range:9700,  speed:905, fuel_kgh:7800,  list_m:258.8, lease_k:600, mtow:247.2, engines:2, co2_rpk:100, cask_usc:8.0, cost_seat_hr:31, util_day_h:13.0, pilots:26, notes:"" },
  { id:"B777-200ER",  mfr:"BOEING",    family:"B777",  type:"WIDEBODY",   role:"PAX",   entry:1997, pax:440,  range:13080, speed:905, fuel_kgh:8100,  list_m:306.6, lease_k:700, mtow:297.6, engines:2, co2_rpk:96,  cask_usc:7.6, cost_seat_hr:29, util_day_h:14.0, pilots:26, notes:"" },
  { id:"B777-200LR",  mfr:"BOEING",    family:"B777",  type:"WIDEBODY",   role:"PAX",   entry:2006, pax:317,  range:15843, speed:905, fuel_kgh:8500,  list_m:346.9, lease_k:800, mtow:347.8, engines:2, co2_rpk:120, cask_usc:9.5, cost_seat_hr:37, util_day_h:16.0, pilots:26, notes:"" },
  { id:"B777-300",    mfr:"BOEING",    family:"B777",  type:"WIDEBODY",   role:"PAX",   entry:1998, pax:550,  range:11120, speed:905, fuel_kgh:9500,  list_m:282.0, lease_k:700, mtow:299.4, engines:2, co2_rpk:90,  cask_usc:7.2, cost_seat_hr:28, util_day_h:13.5, pilots:26, notes:"" },
  { id:"B777-300ER",  mfr:"BOEING",    family:"B777",  type:"WIDEBODY",   role:"PAX",   entry:2004, pax:550,  range:13650, speed:905, fuel_kgh:9700,  list_m:375.5, lease_k:950, mtow:352.4, engines:2, co2_rpk:88,  cask_usc:7.0, cost_seat_hr:27, util_day_h:15.0, pilots:26, notes:"Widebody più diffuso decennio 2010" },
  { id:"B777F",       mfr:"BOEING",    family:"B777",  type:"WIDEBODY",   role:"CARGO", entry:2009, pax:0,    range:9070,  speed:905, fuel_kgh:9600,  list_m:352.3, lease_k:900, mtow:347.8, engines:2, co2_rpk:null,cask_usc:null,cost_seat_hr:null,util_day_h:14.0, pilots:26, notes:"Freighter più venduto" },
  { id:"B777-9",      mfr:"BOEING",    family:"B777X", type:"WIDEBODY",   role:"PAX",   entry:2026, pax:426,  range:13500, speed:905, fuel_kgh:8800,  list_m:442.2, lease_k:1200,mtow:352.4, engines:2, co2_rpk:72,  cask_usc:5.5, cost_seat_hr:21, util_day_h:15.5, pilots:26, dim_l_m:76.7, dim_ws_m:71.8, dim_h_m:18.5, notes:"Ala ripiegabile. Previsto 2026." },
  { id:"B777-8",      mfr:"BOEING",    family:"B777X", type:"WIDEBODY",   role:"PAX",   entry:2027, pax:384,  range:16170, speed:905, fuel_kgh:8200,  list_m:425.8, lease_k:1150,mtow:352.4, engines:2, co2_rpk:73,  cask_usc:5.7, cost_seat_hr:22, util_day_h:16.0, pilots:26, dim_l_m:69.9, dim_ws_m:71.8, dim_h_m:17.5, notes:"Ultra long, previsto 2027" },
  { id:"B787-8",      mfr:"BOEING",    family:"B787",  type:"WIDEBODY",   role:"PAX",   entry:2011, pax:381,  range:13620, speed:903, fuel_kgh:5900,  list_m:248.3, lease_k:780, mtow:227.9, engines:2, co2_rpk:60,  cask_usc:5.2, cost_seat_hr:20, util_day_h:14.5, pilots:26, notes:"-20% fuel vs 767" },
  { id:"B787-9",      mfr:"BOEING",    family:"B787",  type:"WIDEBODY",   role:"PAX",   entry:2014, pax:420,  range:14140, speed:903, fuel_kgh:6450,  list_m:292.5, lease_k:900, mtow:254.0, engines:2, co2_rpk:55,  cask_usc:4.8, cost_seat_hr:19, util_day_h:15.0, pilots:26, dim_l_m:63.0, dim_ws_m:60.0, dim_h_m:17.0, notes:"Più efficiente widebody (55g CO2/RPK)" },
  { id:"B787-10",     mfr:"BOEING",    family:"B787",  type:"WIDEBODY",   role:"PAX",   entry:2018, pax:440,  range:11910, speed:903, fuel_kgh:6900,  list_m:338.4, lease_k:980, mtow:254.0, engines:2, co2_rpk:60,  cask_usc:4.5, cost_seat_hr:20, util_day_h:14.0, pilots:26, dim_l_m:68.3, dim_ws_m:60.1, dim_h_m:17.0, notes:"CASM più basso widebody USA" },
  { id:"B747-400",    mfr:"BOEING",    family:"B747",  type:"WIDEBODY",   role:"PAX",   entry:1989, pax:660,  range:13450, speed:910, fuel_kgh:11000, list_m:228.0, lease_k:400, mtow:412.8, engines:4, co2_rpk:88,  cask_usc:7.0, cost_seat_hr:27, util_day_h:13.5, pilots:26, notes:"Queen of the Skies. Ritirata da molte flotte" },
  { id:"B747-400F",   mfr:"BOEING",    family:"B747",  type:"WIDEBODY",   role:"CARGO", entry:1993, pax:0,    range:8130,  speed:910, fuel_kgh:10800, list_m:220.0, lease_k:400, mtow:412.8, engines:4, co2_rpk:null,cask_usc:null,cost_seat_hr:null,util_day_h:13.0, pilots:26, notes:"Nose-loading" },
  { id:"B747-8",      mfr:"BOEING",    family:"B747",  type:"WIDEBODY",   role:"PAX",   entry:2012, pax:605,  range:14815, speed:912, fuel_kgh:10000, list_m:402.9, lease_k:700, mtow:447.7, engines:4, co2_rpk:82,  cask_usc:6.5, cost_seat_hr:25, util_day_h:14.0, pilots:26, notes:"Solo Lufthansa/Korean Air" },
  { id:"B747-8F",     mfr:"BOEING",    family:"B747",  type:"WIDEBODY",   role:"CARGO", entry:2011, pax:0,    range:8130,  speed:912, fuel_kgh:9900,  list_m:380.0, lease_k:700, mtow:447.7, engines:4, co2_rpk:null,cask_usc:null,cost_seat_hr:null,util_day_h:13.5, pilots:26, notes:"Più venduta della famiglia 8" },
  { id:"MD-11",       mfr:"MCDONNELL", family:"MD-11", type:"WIDEBODY",   role:"PAX",   entry:1990, pax:410,  range:12600, speed:876, fuel_kgh:8500,  list_m:195.0, lease_k:350, mtow:285.8, engines:3, co2_rpk:108, cask_usc:8.8, cost_seat_hr:34, util_day_h:12.0, pilots:26, notes:"3 motori. Convertiti cargo FedEx" },
  { id:"MD-11F",      mfr:"MCDONNELL", family:"MD-11", type:"WIDEBODY",   role:"CARGO", entry:1991, pax:0,    range:8216,  speed:876, fuel_kgh:8600,  list_m:195.0, lease_k:340, mtow:285.8, engines:3, co2_rpk:null,cask_usc:null,cost_seat_hr:null,util_day_h:12.5, pilots:26, notes:"" },
  { id:"IL-96-300",   mfr:"ILYUSHIN",  family:"IL-96", type:"WIDEBODY",   role:"PAX",   entry:1993, pax:300,  range:9000,  speed:870, fuel_kgh:9800,  list_m:60.0,  lease_k:150, mtow:250.0, engines:4, co2_rpk:130, cask_usc:11,  cost_seat_hr:42, util_day_h:9.0,  pilots:26, notes:"Solo Aeroflot/Cuba" },
  { id:"C929",        mfr:"COMAC",     family:"C929",  type:"WIDEBODY",   role:"PAX",   entry:2030, pax:280,  range:12000, speed:900, fuel_kgh:6500,  list_m:250.0, lease_k:800, mtow:245.0, engines:2, co2_rpk:78,  cask_usc:6.5, cost_seat_hr:25, util_day_h:14.0, pilots:26, dim_l_m:63.0, dim_ws_m:60.3, dim_h_m:17.4, notes:"In sviluppo" },
];

// ─── GAME MODEL ID MAPPING ──────────────────────────────────────────────────
// Maps catalog IDs → game model IDs (for acquisition dispatch)
const CATALOG_TO_GAME_ID: Record<string, string> = {
  "A220-100":    "a220-100",
  "A220-300":    "a220-300",
  "A319ceo":     "a319ceo",
  "A320ceo":     "a320ceo",
  "A321ceo":     "a321ceo",
  "A319neo":     "a319neo",
  "A320neo":     "airbus-a320neo",
  "A321neo":     "airbus-a321neo",
  "A321LR":      "a321lr",
  "A321XLR":     "a321xlr",
  "B737-300":    "b737-300",
  "B737-400":    "b737-400",
  "B737-500":    "b737-500",
  "B737-600":    "b737-600",
  "B737-700":    "b737-700",
  "B737-800":    "boeing-737-800",
  "B737-900":    "b737-900",
  "B737-900ER":  "b737-900er",
  "B737-MAX7":   "b737-max7",
  "B737-MAX8":   "boeing-737-max-8",
  "B737-MAX9":   "b737-max9",
  "B737-MAX10":  "b737-max10",
  "B757-200":    "b757-200",
  "B757-300":    "b757-300",
  "B757-200F":   "b757-200f",
  "MD-80":       "md-80",
  "MD-90":       "md-90",
  "MC-21-300":   "mc-21-300",
  "C919":        "c919",
  "ARJ21":       "arj21",
  "E170":        "e170",
  "E175":        "embraer-e175",
  "E190":        "e190",
  "E195":        "e195",
  "E175-E2":     "e175-e2",
  "E190-E2":     "e190-e2",  // mapped via embraer-e190 if needed
  "E195-E2":     "e195-e2",
  "CRJ-700":     "crj-700",
  "CRJ-900":     "crj-900",
  "CRJ-1000":    "crj-1000",
  "ATR42-600":   "atr-42-600",
  "ATR72-600":   "atr-72-600",
  "A300-600":    "a300-600",
  "A310-300":    "a310-300",
  "A330-200":    "a330-200",
  "A330-300":    "a330-300",
  "A330-800neo": "a330-800neo",
  "A330-900neo": "airbus-a330-900",
  "A330-200F":   "a330-200f",
  "A340-300":    "a340-300",
  "A340-500":    "a340-500",
  "A340-600":    "a340-600",
  "A350-900":    "airbus-a350-900",
  "A350-1000":   "a350-1000",
  "A350-900ULR": "a350-900ulr",
  "A350F":       "a350f",
  "A380-800":    "airbus-a380-800",
  "B767-200ER":  "b767-200er",
  "B767-300ER":  "b767-300er",
  "B767-400ER":  "b767-400er",
  "B767-300F":   "boeing-767f",
  "B777-200":    "b777-200",
  "B777-200ER":  "b777-200er",
  "B777-200LR":  "b777-200lr",
  "B777-300":    "b777-300",
  "B777-300ER":  "boeing-777-300er",
  "B777F":       "boeing-777f",
  "B777-9":      "b777-9",
  "B777-8":      "b777-8",
  "B787-8":      "b787-8",
  "B787-9":      "boeing-787-9",
  "B787-10":     "b787-10",
  "B747-400":    "b747-400",
  "B747-400F":   "b747-400f",
  "B747-8":      "b747-8",
  "B747-8F":     "b747-8f",
  "MD-11":       "md-11",
  "MD-11F":      "md-11f",
  "IL-96-300":   "il-96-300",
  "C929":        "c929",
};

function getGameModelId(catalogId: string): string | null {
  const mapped = CATALOG_TO_GAME_ID[catalogId];
  if (!mapped) return null;
  return aircraftModelById.has(mapped) ? mapped : null;
}

// ─── COLORI ──────────────────────────────────────────────────────────────────
const MFR_COLOR: Record<string, string> = {
  AIRBUS:"#00C8FF", BOEING:"#F59E0B", EMBRAER:"#34D399",
  BOMBARDIER:"#A78BFA", ATR:"#F87171", MCDONNELL:"#FB923C",
  ILYUSHIN:"#94A3B8", IRKUT:"#C084FC", COMAC:"#FDE68A",
};
const CMP_COLORS = ["#00C8FF","#F59E0B","#34D399","#F87171","#A78BFA","#FB923C"];
const TYPE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  NARROWBODY:{ label:"NARROW",   bg:"#1E3A5F", text:"#93C5FD" },
  WIDEBODY:  { label:"WIDE",     bg:"#3B2560", text:"#C4B5FD" },
  REGIONAL:  { label:"REGIONAL", bg:"#1A3A2A", text:"#6EE7B7" },
  TURBOPROP: { label:"TURBO",    bg:"#3A2A10", text:"#FCD34D" },
};
function co2Color(v: number | null): string {
  if (!v) return "#374151";
  if (v <= 60) return "#34D399"; if (v <= 75) return "#6EE7B7";
  if (v <= 90) return "#FCD34D"; if (v <= 110) return "#F87171";
  return "#EF4444";
}
function caskColor(v: number | null): string {
  if (!v) return "#374151";
  if (v <= 4.5) return "#34D399"; if (v <= 5.5) return "#6EE7B7";
  if (v <= 7) return "#FCD34D";   if (v <= 9) return "#F87171";
  return "#EF4444";
}
const fmtM = (v: number) => v >= 1000 ? `$${(v/1000).toFixed(1)}B` : `$${v}M`;
const fmtK = (v: number) => `$${v}K/mo`;
const nd = (v: number | null | undefined, suffix = "") => v != null ? `${v}${suffix}` : "—";

// ─── FILTRI NUMERICI ─────────────────────────────────────────────────────────
interface FilterCfg { key: keyof CatalogAircraft; label: string; unit: string; min: number; max: number; step: number; }
const NUMERIC_FILTERS: FilterCfg[] = [
  { key:"pax",          label:"Pax max",      unit:"posti", min:0,    max:900,   step:10  },
  { key:"range",        label:"Range",         unit:"km",    min:1000, max:18000, step:100 },
  { key:"fuel_kgh",     label:"Fuel kg/h",     unit:"kg/h",  min:500,  max:13000, step:100 },
  { key:"co2_rpk",      label:"CO₂ g/RPK",     unit:"g",     min:50,   max:135,   step:1   },
  { key:"cask_usc",     label:"CASK ¢/ASK",    unit:"¢",     min:3.5,  max:12,    step:0.1 },
  { key:"cost_seat_hr", label:"$/Seat/H",       unit:"$",     min:15,   max:45,    step:1   },
  { key:"util_day_h",   label:"Utilizzo h/gg", unit:"h",     min:6,    max:17,    step:0.5 },
  { key:"list_m",       label:"List price",     unit:"$M",    min:20,   max:450,   step:5   },
  { key:"lease_k",      label:"Lease/mese",     unit:"$K",    min:60,   max:1300,  step:10  },
  { key:"entry",        label:"Anno entrata",   unit:"",      min:1980, max:2030,  step:1   },
];
type NumRangeState = Record<string, { min: number; max: number; active: boolean }>;
function initRanges(): NumRangeState {
  const r: NumRangeState = {};
  NUMERIC_FILTERS.forEach(f => { r[f.key as string] = { min: f.min, max: f.max, active: false }; });
  return r;
}

// ─── RADAR CHART ─────────────────────────────────────────────────────────────
const RADAR_AXES = ["Range","Capac.","Eco CO₂","Eco CASK","Utilizzo","$/Seat/H"];
function radarScore(aircraft: CatalogAircraft): (number | null)[] | null {
  if (aircraft.role !== "PAX") return null;
  const all = AIRCRAFT_DATA.filter(a => a.role === "PAX");
  const norm = (v: number, key: keyof CatalogAircraft, invert = false) => {
    const vals = all.map(a => a[key] as number).filter(x => x != null);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    if (mx === mn) return 0.5;
    const s = (v - mn) / (mx - mn);
    return invert ? 1 - s : s;
  };
  return [
    norm(aircraft.range, "range"),
    norm(aircraft.pax, "pax"),
    aircraft.co2_rpk   != null ? norm(aircraft.co2_rpk,   "co2_rpk",   true) : null,
    aircraft.cask_usc  != null ? norm(aircraft.cask_usc,  "cask_usc",  true) : null,
    norm(aircraft.util_day_h, "util_day_h"),
    aircraft.cost_seat_hr != null ? norm(aircraft.cost_seat_hr, "cost_seat_hr", true) : null,
  ];
}

function RadarChart({ items }: { items: { aircraft: CatalogAircraft; color: string }[] }) {
  const cx = 150, cy = 150, r = 100, sides = 6;
  const angleOf = (i: number) => -Math.PI / 2 + i * (Math.PI * 2 / sides);
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  return (
    <svg width={300} height={300} style={{ overflow: "visible" }}>
      {gridLevels.map(lvl => (
        <polygon key={lvl} fill="none" stroke="#1E2D45" strokeWidth="1"
          points={Array.from({ length: sides }, (_, i) => {
            const a = angleOf(i);
            return `${cx + r * lvl * Math.cos(a)},${cy + r * lvl * Math.sin(a)}`;
          }).join(" ")} />
      ))}
      {Array.from({ length: sides }, (_, i) => {
        const a = angleOf(i);
        return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="#1E2D45" strokeWidth="1" />;
      })}
      {RADAR_AXES.map((label, i) => {
        const a = angleOf(i);
        return <text key={i} x={cx + (r + 20) * Math.cos(a)} y={cy + (r + 20) * Math.sin(a)}
          textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#64748B"
          fontFamily="Inter,system-ui,sans-serif">{label}</text>;
      })}
      {items.map((item, idx) => {
        const scores = radarScore(item.aircraft);
        if (!scores) return null;
        const pts = scores.map((s, i) => {
          const val = s ?? 0;
          const a = angleOf(i);
          return `${cx + r * val * Math.cos(a)},${cy + r * val * Math.sin(a)}`;
        }).join(" ");
        return (
          <polygon key={item.aircraft.id} points={pts}
            fill={CMP_COLORS[idx] + "33"} stroke={CMP_COLORS[idx]}
            strokeWidth="2" strokeLinejoin="round" />
        );
      })}
    </svg>
  );
}

// ─── MINI BAR ────────────────────────────────────────────────────────────────
function MiniBar({ items, metricKey, label, invert = false, fmtFn }: {
  items: { aircraft: CatalogAircraft }[];
  metricKey: keyof CatalogAircraft;
  label: string;
  invert?: boolean;
  fmtFn?: (v: number) => string;
}) {
  const vals = items.map(it => it.aircraft[metricKey] as number | null);
  const validVals = vals.filter((v): v is number => v != null);
  if (validVals.length === 0) return null;
  const maxVal = Math.max(...validVals);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, color: "#64748B", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>
        {label}{invert ? " ↓ migliore" : " ↑ migliore"}
      </div>
      {items.map((it, idx) => {
        const v = it.aircraft[metricKey] as number | null;
        const barW = v != null ? (invert ? (1 - v / maxVal) * 100 + 10 : v / maxVal * 100) : 0;
        return (
          <div key={it.aircraft.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 70, fontSize: 10, fontWeight: 700, color: CMP_COLORS[idx], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{it.aircraft.id}</div>
            <div style={{ flex: 1, background: "#0A1220", borderRadius: 3, height: 14, position: "relative" }}>
              {v != null && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(barW, 2)}%`, background: CMP_COLORS[idx] + "99", borderRadius: 3, borderRight: `2px solid ${CMP_COLORS[idx]}` }} />}
            </div>
            <div style={{ width: 60, textAlign: "right", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: v == null ? "#374151" : CMP_COLORS[idx] }}>
              {v == null ? "—" : fmtFn ? fmtFn(v) : v}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── NUMERIC FILTER ROW ───────────────────────────────────────────────────────
function NumericFilterRow({ cfg, range, onChange }: {
  cfg: FilterCfg;
  range: NumRangeState;
  onChange: (key: string, val: { min: number; max: number; active: boolean }) => void;
}) {
  const { key, label, unit, min, max, step } = cfg;
  const cur = range[key as string];
  const isActive = cur.active;
  const pctMin = ((cur.min - min) / (max - min)) * 100;
  const pctMax = ((cur.max - min) / (max - min)) * 100;
  return (
    <div style={{ padding: "10px 12px", background: isActive ? "#0A1628" : "#080E1A", borderRadius: 8, border: `1px solid ${isActive ? "#1E3A5F" : "#0D1729"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? "#00C8FF" : "#64748B", letterSpacing: "0.06em" }}>{label.toUpperCase()}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#94A3B8" }}>{cur.min}{unit} – {cur.max}{unit}</span>
          {isActive && <button onClick={() => onChange(key as string, { min, max, active: false })} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 11 }}>✕</button>}
        </div>
      </div>
      <div style={{ position: "relative", height: 20 }}>
        <div style={{ position: "absolute", left: `${pctMin}%`, right: `${100 - pctMax}%`, height: 4, top: 8, background: isActive ? "#00C8FF" : "#1E2D45", borderRadius: 2 }} />
        <div style={{ position: "absolute", left: 0, right: 0, height: 4, top: 8, background: "#0D1729", borderRadius: 2, zIndex: 0 }} />
        <input type="range" min={min} max={max} step={step} value={cur.min}
          onChange={e => { const v = Math.min(Number(e.target.value), cur.max - step); onChange(key as string, { ...cur, min: v, active: true }); }}
          style={{ position: "absolute", width: "100%", top: 0, height: 20, appearance: "none", WebkitAppearance: "none", background: "transparent", cursor: "pointer", zIndex: 2 }} />
        <input type="range" min={min} max={max} step={step} value={cur.max}
          onChange={e => { const v = Math.max(Number(e.target.value), cur.min + step); onChange(key as string, { ...cur, max: v, active: true }); }}
          style={{ position: "absolute", width: "100%", top: 0, height: 20, appearance: "none", WebkitAppearance: "none", background: "transparent", cursor: "pointer", zIndex: 2 }} />
      </div>
    </div>
  );
}

// ─── AIRCRAFT CARD MODAL ─────────────────────────────────────────────────────
type CardTab = "specs" | "economy" | "acquire";

// Sconto bulk: basato su ricerche reali su strutture di sconto fleet order Airbus/Boeing.
// Le compagnie reali ottengono 40-60% sul listino per grandi ordini; queste % sono
// lo sconto *aggiuntivo* rispetto al prezzo già negoziato del gioco.
function bulkDiscount(qty: number, mode: "leased" | "owned" | "acmi"): number {
  if (qty <= 1) return 0;
  // Acquisto: sconto più alto (Boeing/Airbus tipicamente 3-20% per ordini 2-20+)
  // Leasing: sconto più basso (lessor ha meno margine da cedere)
  // ACMI: nessuno sconto (tariffa oraria fissa)
  if (mode === "acmi") return 0;
  const tiers = mode === "owned"
    ? [[2,3,0.03],[4,6,0.06],[7,10,0.10],[11,20,0.15],[21,Infinity,0.20]] as const
    : [[2,3,0.02],[4,6,0.04],[7,10,0.07],[11,20,0.10],[21,Infinity,0.13]] as const;
  for (const [lo, hi, pct] of tiers) {
    if (qty >= lo && qty <= hi) return pct;
  }
  return 0;
}

function AircraftCard({ ac, onClose, cash, onAcquire }: {
  ac: CatalogAircraft;
  onClose: () => void;
  cash: number;
  onAcquire: (catalogId: string, mode: "leased" | "owned" | "acmi", qty: number) => void;
}) {
  const [tab, setTab] = useState<CardTab>("specs");
  const [acqMode, setAcqMode] = useState<"leased" | "owned" | "acmi">("leased");
  const [qty, setQty] = useState(1);
  const [acquiring, setAcquiring] = useState(false);
  const gameModelId = getGameModelId(ac.id);
  const gameModel = gameModelId ? aircraftModelById.get(gameModelId) : null;

  const baseLeasing = gameModel ? gameModel.monthlyLease * 3 : ac.lease_k * 3 * 1000;
  const baseNuovo   = gameModel ? gameModel.purchasePrice : ac.list_m * 1_000_000;
  const acmiDeposit = 900_000;

  const discount = bulkDiscount(qty, acqMode);
  const discountedLeasing = Math.round(baseLeasing * (1 - discount));
  const discountedNuovo   = Math.round(baseNuovo   * (1 - discount));

  const unitCost = acqMode === "owned" ? discountedNuovo : acqMode === "acmi" ? acmiDeposit : discountedLeasing;
  const totalCost = unitCost * qty;
  const canAfford = cash >= totalCost;

  function handleAcquire() {
    if (!gameModel) return;
    setAcquiring(true);
    setTimeout(() => {
      onAcquire(ac.id, acqMode, qty);
      setAcquiring(false);
    }, 400);
  }

  const tb = (id: CardTab, label: string) => (
    <button onClick={() => setTab(id)} style={{
      background: tab === id ? "#0F1829" : "none",
      border: tab === id ? "1px solid #1E2D45" : "1px solid transparent",
      borderRadius: 6, padding: "5px 14px", fontSize: 11, fontWeight: 600,
      color: tab === id ? "#00C8FF" : "#64748B", cursor: "pointer"
    }}>{label}</button>
  );

  const mfrColor = MFR_COLOR[ac.mfr] ?? "#94A3B8";
  const typeBadge = TYPE_BADGE[ac.type];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000CC", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#0A1220", border: "1px solid #1E2D45", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 600, maxHeight: "88vh", overflowY: "auto", padding: 0 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: "#0D1729", padding: "14px 16px", borderRadius: "16px 16px 0 0", borderBottom: "1px solid #1E2D45", position: "sticky", top: 0, zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: mfrColor, background: mfrColor + "22", borderRadius: 4, padding: "2px 7px" }}>{ac.mfr}</span>
                {typeBadge && <span style={{ fontSize: 10, fontWeight: 700, color: typeBadge.text, background: typeBadge.bg, borderRadius: 4, padding: "2px 7px" }}>{typeBadge.label}</span>}
                <span style={{ fontSize: 10, fontWeight: 700, color: ac.role === "CARGO" ? "#FB923C" : "#34D399", background: ac.role === "CARGO" ? "#2A1A0A" : "#0F2A1F", borderRadius: 4, padding: "2px 7px" }}>{ac.role}</span>
                {!gameModel && <span style={{ fontSize: 10, color: "#F87171", background: "#2A0A0A", borderRadius: 4, padding: "2px 7px" }}>Solo riferimento</span>}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#F8FAFC" }}>{ac.id}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{ac.family} · In servizio dal {ac.entry}{ac.notes && ` · ${ac.notes}`}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748B", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {tb("specs", "SPECIFICHE")}
            {tb("economy", "ECONOMIA")}
            {tb("acquire", "ACQUISTA")}
          </div>
        </div>

        <div style={{ padding: "16px" }}>
          {/* SPECIFICHE */}
          {tab === "specs" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  ["Pax (alta densità)", nd(ac.pax, " pax")],
                  ["Range", `${ac.range.toLocaleString("it-IT")} km`],
                  ["Velocità crociera", `${ac.speed} km/h`],
                  ["Motori", `${ac.engines}×`],
                  ["MTOW", `${ac.mtow} t`],
                  ["Fuel burn", `${ac.fuel_kgh.toLocaleString("it-IT")} kg/h`],
                  ["Utilizzo typ.", `${ac.util_day_h} h/gg`],
                  ["Piloti min.", `${ac.pilots}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: "#080E1A", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "#64748B", marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC" }}>{v}</div>
                  </div>
                ))}
              </div>
              {(ac.dim_l_m || ac.dim_ws_m) && (
                <div style={{ background: "#080E1A", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#64748B", marginBottom: 6 }}>DIMENSIONI</div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {ac.dim_l_m && <div><div style={{ fontSize: 10, color: "#4B5563" }}>Lunghezza</div><div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>{ac.dim_l_m} m</div></div>}
                    {ac.dim_ws_m && <div><div style={{ fontSize: 10, color: "#4B5563" }}>Apertura alare</div><div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>{ac.dim_ws_m} m</div></div>}
                    {ac.dim_h_m && <div><div style={{ fontSize: 10, color: "#4B5563" }}>Altezza</div><div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>{ac.dim_h_m} m</div></div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ECONOMIA */}
          {tab === "economy" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  ["List price", fmtM(ac.list_m)],
                  ["Lease/mese", fmtK(ac.lease_k)],
                  ["CO₂ g/RPK", ac.co2_rpk != null ? { value: `${ac.co2_rpk} g`, color: co2Color(ac.co2_rpk) } : "—"],
                  ["CASK ¢/ASK", ac.cask_usc != null ? { value: `${ac.cask_usc}¢`, color: caskColor(ac.cask_usc) } : "—"],
                  ["$/Seat/H", ac.cost_seat_hr != null ? `$${ac.cost_seat_hr}` : "—"],
                  ["Efficienza CO₂", ac.co2_rpk != null ? (ac.co2_rpk <= 65 ? "★★★ Eccellente" : ac.co2_rpk <= 80 ? "★★ Buona" : "★ Scarsa") : "—"],
                ].map(([k, v]) => {
                  const isObj = typeof v === "object" && v !== null && "value" in v;
                  return (
                    <div key={k as string} style={{ background: "#080E1A", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "#64748B", marginBottom: 2 }}>{k as string}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isObj ? (v as { color: string }).color : "#F8FAFC" }}>
                        {isObj ? (v as { value: string }).value : v as string}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Radar */}
              {ac.role === "PAX" && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                  <RadarChart items={[{ aircraft: ac, color: mfrColor }]} />
                </div>
              )}
            </div>
          )}

          {/* ACQUISTA */}
          {tab === "acquire" && (
            <div>
              {!gameModel ? (
                <div style={{ background: "#1A0A0A", border: "1px solid #4B1A1A", borderRadius: 10, padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "#F87171", fontWeight: 700, marginBottom: 6 }}>Non disponibile per l'acquisto</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>Questo modello è nel catalogo come riferimento ma non è ancora operativo nel tuo scenario di gioco.</div>
                </div>
              ) : (
                <>
                  {/* Mode selector */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                    {([["leased", "DRY LEASE", "#00C8FF"], ["owned", "ACQUISTO", "#34D399"], ["acmi", "ACMI", "#F59E0B"]] as const).map(([mode, label, color]) => (
                      <button key={mode} onClick={() => setAcqMode(mode)} style={{
                        background: acqMode === mode ? color + "22" : "#080E1A",
                        border: `1px solid ${acqMode === mode ? color : "#1E2D45"}`,
                        borderRadius: 8, padding: "10px 6px", cursor: "pointer",
                        color: acqMode === mode ? color : "#4B5563", fontSize: 10, fontWeight: 700
                      }}>{label}</button>
                    ))}
                  </div>

                  {/* Contatore quantità */}
                  <div style={{ background: "#080E1A", borderRadius: 10, padding: "14px", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>Quantità</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #1E2D45", background: "#0D1729", color: "#E2E8F0", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <span style={{ fontSize: 20, fontWeight: 800, color: "#F8FAFC", minWidth: 28, textAlign: "center" }}>{qty}</span>
                        <button onClick={() => setQty(q => Math.min(50, q + 1))} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #1E2D45", background: "#0D1729", color: "#E2E8F0", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                    </div>
                    {/* Scala sconti */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                      {([[1,1,0],[2,3,acqMode==="owned"?3:2],[4,6,acqMode==="owned"?6:4],[7,10,acqMode==="owned"?10:7],[11,20,acqMode==="owned"?15:10],[21,50,acqMode==="owned"?20:13]] as [number,number,number][]).map(([lo, hi, pct]) => {
                        const active = qty >= lo && qty <= hi;
                        const isAcmi = acqMode === "acmi";
                        return (
                          <div key={lo} onClick={() => !isAcmi && setQty(lo)} style={{
                            padding: "4px 8px", borderRadius: 6, cursor: isAcmi ? "default" : "pointer",
                            background: active ? "#00C8FF22" : "#0D1729",
                            border: `1px solid ${active ? "#00C8FF" : "#1E2D45"}`,
                            fontSize: 10, fontWeight: 700,
                            color: active ? "#00C8FF" : isAcmi ? "#374151" : "#4B5563",
                          }}>
                            {lo === hi ? lo : `${lo}–${hi === 50 ? "50+" : hi}`} {pct > 0 && !isAcmi ? <span style={{ color: active ? "#34D399" : "#374151" }}>−{pct}%</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Riepilogo prezzo */}
                  <div style={{ background: "#080E1A", borderRadius: 10, padding: "14px", marginBottom: 12 }}>
                    {acqMode === "leased" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "#64748B" }}>Deposito per aereo{discount > 0 ? <span style={{ color: "#34D399" }}> −{Math.round(discount*100)}%</span> : null}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#00C8FF" }}>${(discountedLeasing / 1_000_000).toFixed(2)}M</div>
                          {discount > 0 && <div style={{ fontSize: 10, color: "#374151", textDecoration: "line-through" }}>${(baseLeasing / 1_000_000).toFixed(2)}M</div>}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "#64748B" }}>Totale deposito ×{qty}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#F8FAFC" }}>${(totalCost / 1_000_000).toFixed(2)}M</div>
                        </div>
                        <div style={{ gridColumn: "1/-1", fontSize: 10, color: "#64748B", borderTop: "1px solid #1E2D45", paddingTop: 6, marginTop: 2 }}>Canone mensile per aereo: {fmtK(ac.lease_k)} · Crew e manutenzione a tuo carico.</div>
                      </div>
                    )}
                    {acqMode === "owned" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "#64748B" }}>Prezzo unitario{discount > 0 ? <span style={{ color: "#34D399" }}> −{Math.round(discount*100)}%</span> : null}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#34D399" }}>${(discountedNuovo / 1_000_000).toFixed(1)}M</div>
                          {discount > 0 && <div style={{ fontSize: 10, color: "#374151", textDecoration: "line-through" }}>${(baseNuovo / 1_000_000).toFixed(1)}M</div>}
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "#64748B" }}>Totale ordine ×{qty}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#F8FAFC" }}>${(totalCost / 1_000_000).toFixed(1)}M</div>
                        </div>
                        {discount > 0 && <div style={{ gridColumn: "1/-1", fontSize: 10, color: "#34D399" }}>Risparmio ordine: ${((baseNuovo - discountedNuovo) * qty / 1_000_000).toFixed(1)}M</div>}
                      </div>
                    )}
                    {acqMode === "acmi" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div><div style={{ fontSize: 10, color: "#64748B" }}>Tariffa/aereo</div><div style={{ fontSize: 15, fontWeight: 800, color: "#F59E0B" }}>$9.000/h</div></div>
                        <div><div style={{ fontSize: 10, color: "#64748B" }}>Deposito totale ×{qty}</div><div style={{ fontSize: 15, fontWeight: 800, color: "#F8FAFC" }}>${(totalCost / 1_000).toFixed(0)}K</div></div>
                        <div style={{ gridColumn: "1/-1", fontSize: 10, color: "#64748B", borderTop: "1px solid #1E2D45", paddingTop: 6, marginTop: 2 }}>Nessuno sconto fleet su ACMI — tariffa oraria fissa per contratto.</div>
                      </div>
                    )}
                  </div>

                  {/* Saldo disponibile */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "8px 12px", background: "#0D1729", borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748B" }}>Liquidità disponibile</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: canAfford ? "#34D399" : "#F87171" }}>${(cash / 1_000_000).toFixed(1)}M</span>
                  </div>

                  <button
                    disabled={!canAfford || acquiring}
                    onClick={handleAcquire}
                    style={{
                      width: "100%", padding: "14px", borderRadius: 10, border: "none", cursor: canAfford ? "pointer" : "not-allowed",
                      background: canAfford ? (acqMode === "owned" ? "#34D399" : acqMode === "acmi" ? "#F59E0B" : "#00C8FF") : "#1A2535",
                      color: canAfford ? "#0A1220" : "#4B5563", fontSize: 13, fontWeight: 800, opacity: acquiring ? 0.6 : 1,
                    }}>
                    {acquiring ? `Acquisizione di ${qty} aereo${qty > 1 ? "i" : ""}…` : !canAfford
                      ? `Mancano $${((totalCost - cash) / 1_000_000).toFixed(1)}M`
                      : qty === 1
                        ? acqMode === "owned" ? `Acquista — $${(discountedNuovo / 1_000_000).toFixed(1)}M`
                          : acqMode === "acmi" ? `ACMI — dep. $900K`
                          : `Dry Lease — dep. $${(discountedLeasing / 1_000_000).toFixed(2)}M`
                        : acqMode === "owned" ? `Ordina ${qty} aerei — $${(totalCost / 1_000_000).toFixed(1)}M${discount > 0 ? ` (−${Math.round(discount*100)}%)` : ""}`
                          : acqMode === "acmi" ? `ACMI ${qty} aerei — dep. $${(totalCost / 1_000).toFixed(0)}K`
                          : `Lease ${qty} aerei — dep. $${(totalCost / 1_000_000).toFixed(2)}M${discount > 0 ? ` (−${Math.round(discount*100)}%)` : ""}`
                    }
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN CATALOG ─────────────────────────────────────────────────────────────
export function AircraftCatalog() {
  const { state, dispatch } = useGame();
  const cash = state?.cash ?? 0;

  const [search,      setSearch]      = useState("");
  const [fMfr,        setFMfr]        = useState("ALL");
  const [fType,       setFType]       = useState("ALL");
  const [fRole,       setFRole]       = useState("ALL");
  const [sortKey,     setSortKey]     = useState<keyof CatalogAircraft>("entry");
  const [sortDir,     setSortDir]     = useState(1);
  const [activeTab,   setActiveTab]   = useState<"ops" | "econ" | "green">("ops");
  const [selectedCard,setSelectedCard]= useState<string | null>(null);
  const [compareIds,  setCompareIds]  = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [numRanges,   setNumRanges]   = useState<NumRangeState>(initRanges);
  const [showFilters, setShowFilters] = useState(false);

  const manufacturers = useMemo(() => ["ALL", ...[...new Set(AIRCRAFT_DATA.map(a => a.mfr))].sort()], []);
  const types = ["ALL","NARROWBODY","WIDEBODY","REGIONAL","TURBOPROP"];
  const roles = ["ALL","PAX","CARGO"];

  const updateRange = useCallback((key: string, val: { min: number; max: number; active: boolean }) => {
    setNumRanges(prev => ({ ...prev, [key]: val }));
  }, []);
  const activeFilterCount = Object.values(numRanges).filter(r => r.active).length;

  const filtered = useMemo(() => {
    return AIRCRAFT_DATA.filter(a => {
      if (fMfr !== "ALL" && a.mfr !== fMfr) return false;
      if (fType !== "ALL" && a.type !== fType) return false;
      if (fRole !== "ALL" && a.role !== fRole) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.id.toLowerCase().includes(q) && !a.family.toLowerCase().includes(q) && !a.notes.toLowerCase().includes(q)) return false;
      }
      for (const f of NUMERIC_FILTERS) {
        const r = numRanges[f.key as string];
        if (!r.active) continue;
        const v = a[f.key] as number | null;
        if (v == null) return false;
        if (v < r.min || v > r.max) return false;
      }
      return true;
    }).sort((a, b) => {
      const va = (a[sortKey] as number | string | null) ?? (sortDir > 0 ? Infinity : -Infinity);
      const vb = (b[sortKey] as number | string | null) ?? (sortDir > 0 ? Infinity : -Infinity);
      if (typeof va === "string") return sortDir * va.localeCompare(vb as string);
      return sortDir * ((va as number) - (vb as number));
    });
  }, [search, fMfr, fType, fRole, sortKey, sortDir, numRanges]);

  const toggleSort = (k: keyof CatalogAircraft) => {
    if (sortKey === k) setSortDir(d => -d);
    else { setSortKey(k); setSortDir(1); }
  };
  const toggleCompare = (id: string) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 6 ? prev : [...prev, id]);
  };
  const compareItems = compareIds.map((id, idx) => ({ aircraft: AIRCRAFT_DATA.find(a => a.id === id)!, color: CMP_COLORS[idx] })).filter(it => it.aircraft);

  const cardAc = selectedCard ? AIRCRAFT_DATA.find(a => a.id === selectedCard) : null;

  function handleAcquire(catalogId: string, mode: "leased" | "owned" | "acmi", qty: number) {
    const gameId = getGameModelId(catalogId);
    if (!gameId) return;
    for (let i = 0; i < qty; i++) {
      dispatch({ type: "ACQUIRE_AIRCRAFT", payload: { modelId: gameId, acquisitionType: mode } });
    }
    setSelectedCard(null);
  }

  const SortTh = ({ k, label, right }: { k: keyof CatalogAircraft; label: string; right?: boolean }) => (
    <th onClick={() => toggleSort(k)} style={{
      cursor: "pointer", textAlign: right ? "right" : "left", padding: "7px 8px",
      color: sortKey === k ? "#00C8FF" : "#4B5563", fontSize: 10, fontWeight: 700,
      letterSpacing: "0.08em", userSelect: "none", whiteSpace: "nowrap",
      borderBottom: "1px solid #1E2D45", background: "#080E1A"
    }}>{label}{sortKey === k ? (sortDir === 1 ? " ▲" : " ▼") : ""}</th>
  );

  const pill = (bg: string, text: string, fg = "#E2E8F0") => (
    <span style={{ fontSize: 9, fontWeight: 700, background: bg, color: fg, borderRadius: 4, padding: "2px 5px", whiteSpace: "nowrap" }}>{text}</span>
  );

  const VTab = ({ id, label }: { id: "ops" | "econ" | "green"; label: string }) => (
    <button onClick={() => setActiveTab(id)} style={{
      background: activeTab === id ? "#0F1829" : "none",
      border: activeTab === id ? "1px solid #1E2D45" : "1px solid transparent",
      borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600,
      color: activeTab === id ? "#00C8FF" : "#64748B", cursor: "pointer"
    }}>{label}</button>
  );

  return (
    <div style={{ background: "#080E1A", minHeight: "100vh", color: "#E2E8F0", fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* HEADER */}
      <div style={{ background: "#0A1628", borderBottom: "1px solid #1E2D45", padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <span style={{ color: "#00C8FF", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em" }}>AEROGRID</span>
          <span style={{ color: "#1E2D45" }}>|</span>
          <span style={{ color: "#64748B", fontSize: 10 }}>AIRCRAFT DATABASE v3.0</span>
          <button onClick={() => dispatch({ type: "SET_VIEW", payload: "fleet" })}
            style={{ marginLeft: "auto", background: "none", border: "1px solid #1E2D45", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#64748B", cursor: "pointer" }}>
            ← Flotta
          </button>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#F8FAFC" }}>Catalogo Aerei Commerciali 1984–2030+</div>
        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
          {AIRCRAFT_DATA.length} modelli · CO₂/RPK · CASK · $/seat/h ·
          <span style={{ color: "#00C8FF", marginLeft: 6 }}>Confronto fino a 6 aerei</span>
          <span style={{ color: "#34D399", marginLeft: 6 }}>· ${(cash / 1_000_000).toFixed(1)}M disponibili</span>
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{ padding: "10px 16px", background: "#0D1729", borderBottom: "1px solid #1E2D45", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca modello…"
          style={{ background: "#0F1829", border: "1px solid #1E2D45", color: "#E2E8F0", borderRadius: 6, padding: "5px 10px", fontSize: 11, width: 150, outline: "none" }} />
        {([["MFR", manufacturers, fMfr, setFMfr], ["Tipo", types, fType, setFType], ["Ruolo", roles, fRole, setFRole]] as const).map(([l, opts, val, set]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, color: "#64748B" }}>{l}</span>
            <select value={val} onChange={e => (set as (v: string) => void)(e.target.value)}
              style={{ background: "#0F1829", border: "1px solid #1E2D45", color: "#E2E8F0", borderRadius: 5, padding: "4px 7px", fontSize: 10, outline: "none" }}>
              {opts.map((o: string) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div style={{ display: "flex", gap: 4 }}>
          <VTab id="ops"   label="OPERATIVO" />
          <VTab id="econ"  label="ECONOMICO" />
          <VTab id="green" label="GREEN" />
        </div>

        <button onClick={() => setShowFilters(v => !v)} style={{
          marginLeft: "auto", background: activeFilterCount > 0 ? "#F59E0B18" : showFilters ? "#0F1829" : "#0A1220",
          border: `1px solid ${activeFilterCount > 0 ? "#F59E0B" : "#1E2D45"}`, borderRadius: 6, padding: "5px 12px",
          fontSize: 11, fontWeight: 700, color: activeFilterCount > 0 ? "#F59E0B" : "#4B5563", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6
        }}>
          ⧩ FILTRI
          {activeFilterCount > 0 && <span style={{ background: "#F59E0B", color: "#080E1A", borderRadius: 99, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{activeFilterCount}</span>}
        </button>
        {activeFilterCount > 0 && <button onClick={() => setNumRanges(initRanges())} style={{ background: "none", border: "1px solid #374151", borderRadius: 6, padding: "5px 10px", fontSize: 10, color: "#64748B", cursor: "pointer" }}>✕ Reset</button>}

        <button onClick={() => setShowCompare(v => !v)} style={{
          background: compareIds.length > 0 ? (showCompare ? "#00C8FF22" : "#0F1829") : "#0A1220",
          border: `1px solid ${compareIds.length > 0 ? "#00C8FF" : "#1E2D45"}`, borderRadius: 6, padding: "5px 12px",
          fontSize: 11, fontWeight: 700, color: compareIds.length > 0 ? "#00C8FF" : "#4B5563", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6
        }}>
          ⚖ CONFRONTA
          {compareIds.length > 0 && <span style={{ background: "#00C8FF", color: "#080E1A", borderRadius: 99, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{compareIds.length}</span>}
        </button>
        {compareIds.length > 0 && <button onClick={() => setCompareIds([])} style={{ background: "none", border: "1px solid #374151", borderRadius: 6, padding: "5px 10px", fontSize: 10, color: "#64748B", cursor: "pointer" }}>✕ Svuota</button>}

        <span style={{ fontSize: 10, color: "#64748B" }}>{filtered.length} / {AIRCRAFT_DATA.length}</span>
      </div>

      {/* PANNELLO FILTRI NUMERICI */}
      {showFilters && (
        <div style={{ background: "#0A1220", borderBottom: "2px solid #1E2D45", padding: "14px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {NUMERIC_FILTERS.map(cfg => (
              <NumericFilterRow key={cfg.key as string} cfg={cfg} range={numRanges} onChange={updateRange} />
            ))}
          </div>
        </div>
      )}

      {/* PANNELLO CONFRONTO */}
      {showCompare && compareItems.length > 0 && (
        <div style={{ background: "#0A1220", borderBottom: "2px solid #1E2D45", padding: "16px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#F8FAFC", marginBottom: 12 }}>⚖ Confronto ({compareItems.length} aerei)</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Radar */}
            <div style={{ flexShrink: 0 }}>
              <RadarChart items={compareItems} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {compareItems.map((it, idx) => (
                  <span key={it.aircraft.id} style={{ fontSize: 10, color: CMP_COLORS[idx], fontWeight: 700 }}>● {it.aircraft.id}</span>
                ))}
              </div>
            </div>
            {/* Mini bars */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <MiniBar items={compareItems} metricKey="range" label="RANGE" fmtFn={v => `${v.toLocaleString("it-IT")} km`} />
              <MiniBar items={compareItems} metricKey="pax" label="PAX" fmtFn={v => `${v} pax`} />
              <MiniBar items={compareItems} metricKey="co2_rpk" label="CO₂ g/RPK" invert fmtFn={v => `${v} g`} />
              <MiniBar items={compareItems} metricKey="cask_usc" label="CASK ¢/ASK" invert fmtFn={v => `${v}¢`} />
              <MiniBar items={compareItems} metricKey="list_m" label="LIST PRICE" invert fmtFn={v => fmtM(v)} />
            </div>
          </div>
          {/* Side-by-side table */}
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ padding: "6px 8px", textAlign: "left", color: "#4B5563", fontSize: 10, fontWeight: 700, borderBottom: "1px solid #1E2D45" }}>METRICA</th>
                  {compareItems.map((it, idx) => (
                    <th key={it.aircraft.id} style={{ padding: "6px 8px", textAlign: "right", color: CMP_COLORS[idx], fontSize: 10, fontWeight: 700, borderBottom: "1px solid #1E2D45" }}>{it.aircraft.id}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  ["Pax", "pax", (v: number) => `${v}`],
                  ["Range km", "range", (v: number) => v.toLocaleString("it-IT")],
                  ["Fuel kg/h", "fuel_kgh", (v: number) => v.toLocaleString("it-IT")],
                  ["CO₂ g/RPK", "co2_rpk", (v: number) => `${v}`],
                  ["CASK ¢", "cask_usc", (v: number) => `${v}`],
                  ["$/Seat/H", "cost_seat_hr", (v: number) => `$${v}`],
                  ["List $M", "list_m", (v: number) => fmtM(v)],
                  ["Lease $K", "lease_k", (v: number) => fmtK(v)],
                  ["Motori", "engines", (v: number) => `${v}×`],
                  ["In servizio", "entry", (v: number) => `${v}`],
                ] as [string, keyof CatalogAircraft, (v: number) => string][]).map(([label, key, fmt]) => (
                  <tr key={label} style={{ borderBottom: "1px solid #0D1729" }}>
                    <td style={{ padding: "5px 8px", color: "#64748B", fontSize: 10 }}>{label}</td>
                    {compareItems.map((it, idx) => {
                      const v = it.aircraft[key] as number | null;
                      return <td key={it.aircraft.id} style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: v != null ? CMP_COLORS[idx] : "#374151", fontSize: 11 }}>{v != null ? fmt(v) : "—"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABELLA PRINCIPALE */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: "7px 8px", borderBottom: "1px solid #1E2D45", background: "#080E1A", width: 32 }}></th>
              <SortTh k="id" label="MODELLO" />
              <SortTh k="type" label="TIPO" />
              {activeTab === "ops" && <>
                <SortTh k="pax"        label="PAX"       right />
                <SortTh k="range"      label="RANGE km"  right />
                <SortTh k="speed"      label="KM/H"      right />
                <SortTh k="fuel_kgh"   label="FUEL kg/h" right />
                <SortTh k="util_day_h" label="UTIL h/gg" right />
                <SortTh k="engines"    label="ENG"       right />
              </>}
              {activeTab === "econ" && <>
                <SortTh k="list_m"       label="LIST $M"     right />
                <SortTh k="lease_k"      label="LEASE $K/mo" right />
                <SortTh k="cask_usc"     label="CASK ¢"      right />
                <SortTh k="cost_seat_hr" label="$/SEAT/H"    right />
                <SortTh k="util_day_h"   label="UTIL h/gg"   right />
              </>}
              {activeTab === "green" && <>
                <SortTh k="co2_rpk"      label="CO₂ g/RPK"  right />
                <SortTh k="fuel_kgh"     label="FUEL kg/h"  right />
                <SortTh k="cask_usc"     label="CASK ¢"     right />
                <SortTh k="entry"        label="ANNO"        right />
              </>}
              <th style={{ padding: "7px 8px", borderBottom: "1px solid #1E2D45", background: "#080E1A", fontSize: 10, color: "#4B5563", width: 80 }}>AZIONI</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, rowIdx) => {
              const mfrColor = MFR_COLOR[a.mfr] ?? "#94A3B8";
              const typeBadge = TYPE_BADGE[a.type];
              const inCompare = compareIds.includes(a.id);
              const gameModelId = getGameModelId(a.id);
              const isPlayable = !!gameModelId;
              const rowBg = rowIdx % 2 === 0 ? "#080E1A" : "#07111F";
              return (
                <tr key={a.id} style={{ background: inCompare ? "#001A2A" : rowBg, cursor: "pointer" }}
                  onClick={() => setSelectedCard(a.id)}>
                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                    <button
                      onClick={e => { e.stopPropagation(); toggleCompare(a.id); }}
                      style={{ background: inCompare ? "#00C8FF22" : "none", border: `1px solid ${inCompare ? "#00C8FF" : "#1E2D45"}`, borderRadius: 4, width: 22, height: 22, cursor: "pointer", color: inCompare ? "#00C8FF" : "#374151", fontSize: 12 }}>
                      {inCompare ? "✓" : "+"}
                    </button>
                  </td>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 700, color: "#F8FAFC", fontSize: 12 }}>{a.id}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 9, color: mfrColor, fontWeight: 700 }}>{a.mfr}</span>
                      {!isPlayable && <span style={{ fontSize: 9, color: "#F87171" }}>ref.</span>}
                    </div>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    {typeBadge && pill(typeBadge.bg, typeBadge.label, typeBadge.text)}
                  </td>
                  {activeTab === "ops" && <>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#E2E8F0", fontVariantNumeric: "tabular-nums" }}>{nd(a.pax)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#E2E8F0", fontVariantNumeric: "tabular-nums" }}>{a.range.toLocaleString("it-IT")}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{a.speed}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{a.fuel_kgh.toLocaleString("it-IT")}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{a.util_day_h}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#94A3B8" }}>{a.engines}×</td>
                  </>}
                  {activeTab === "econ" && <>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#E2E8F0", fontVariantNumeric: "tabular-nums" }}>{fmtM(a.list_m)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{fmtK(a.lease_k)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: caskColor(a.cask_usc), fontVariantNumeric: "tabular-nums" }}>{nd(a.cask_usc, "¢")}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{nd(a.cost_seat_hr, "$")}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{a.util_day_h}h</td>
                  </>}
                  {activeTab === "green" && <>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: co2Color(a.co2_rpk), fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{nd(a.co2_rpk, "g")}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{a.fuel_kgh.toLocaleString("it-IT")}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: caskColor(a.cask_usc), fontVariantNumeric: "tabular-nums" }}>{nd(a.cask_usc, "¢")}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748B", fontVariantNumeric: "tabular-nums" }}>{a.entry}</td>
                  </>}
                  <td style={{ padding: "6px 8px" }}>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedCard(a.id); }}
                      style={{ background: isPlayable ? "#00C8FF22" : "#1A2535", border: `1px solid ${isPlayable ? "#00C8FF" : "#1E2D45"}`, borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: isPlayable ? "#00C8FF" : "#374151", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {isPlayable ? "Acquista" : "Info"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✈</div>
            <div>Nessun aereo corrisponde ai filtri selezionati</div>
          </div>
        )}
      </div>

      {/* MODAL CARD */}
      {cardAc && (
        <AircraftCard
          ac={cardAc}
          onClose={() => setSelectedCard(null)}
          cash={cash}
          onAcquire={handleAcquire}
        />
      )}

      {/* STILI SLIDER */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #00C8FF;
          border: 2px solid #0A1220;
          cursor: pointer;
          box-shadow: 0 0 4px #00C8FF88;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          background: transparent;
          height: 4px;
        }
      `}</style>
    </div>
  );
}
