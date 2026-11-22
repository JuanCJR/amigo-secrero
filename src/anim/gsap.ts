import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CustomEase } from 'gsap/CustomEase';
import { CustomBounce } from 'gsap/CustomBounce';
import { CustomWiggle } from 'gsap/CustomWiggle';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';

gsap.registerPlugin(
  useGSAP, Flip, SplitText, ScrambleTextPlugin, MorphSVGPlugin, DrawSVGPlugin,
  CustomEase, CustomBounce, CustomWiggle, Physics2DPlugin,
);

// Easings con carácter (nada de linear ni ease por defecto)
CustomEase.create('jmPop', '.3,1.55,.5,1');          // overshoot fuerte
CustomEase.create('jmSnap', '.7,0,.2,1.35');        // arranca lento y se pasa
CustomBounce.create('jmBounce', { strength: 0.55, squash: 2.4, squashID: 'jmBounceSquash' });
CustomBounce.create('jmDrop', { strength: 0.35, squash: 1.6, squashID: 'jmDropSquash' });
CustomWiggle.create('jmShake', { wiggles: 9, type: 'easeOut' });
CustomWiggle.create('jmWobble', { wiggles: 5, type: 'uniform' });

gsap.defaults({ ease: 'back.out(1.6)', duration: 0.6 });

export { gsap, Flip, SplitText, useGSAP };

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export const prefersReduced = () => !!mq?.matches;

export const rand = gsap.utils.random;
export const clamp = gsap.utils.clamp;
