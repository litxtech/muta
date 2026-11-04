/**
 * StyleSheet.create yamasi — _layout ilk importu.
 * Babel, StyleSheet.create({...}) cagrilarini dogrudan temaliStil(fabrika)'ya
 * cevirir; bu yama yalnizca elle StyleSheet.create(fn) yazan kod icin yedektir.
 * Grup layout'lari kok _layout'tan once yuklendigi icin ona guvenilmez.
 */
import { stilYamasiniUygula } from './TemaliStil';

stilYamasiniUygula();
