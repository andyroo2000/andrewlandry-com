import brooklyn1 from '../assets/brooklyn-1.jpg';
import brooklyn2 from '../assets/brooklyn-2.jpg';
import brooklyn3 from '../assets/brooklyn-3.jpg';
import brooklyn4 from '../assets/brooklyn-4.jpg';
import brooklyn5 from '../assets/brooklyn-5.jpg';
import brooklyn6 from '../assets/brooklyn-6.jpg';
import old1 from '../assets/old-photos-1.jpg';
import old2 from '../assets/old-photos-2.jpg';
import old3 from '../assets/old-photos-3.jpg';
export const photos = {
  geometry: {src:brooklyn1, alt:'Angular concrete buildings under a deep blue Brooklyn sky', caption:'Concrete & sky', year:'2020'},
  truck: {src:brooklyn2, alt:'A red truck against an industrial wall in Brooklyn', caption:'A little red', year:'2020'},
  shadow: {src:brooklyn3, alt:'The shadow of a bare tree stretching across a pale wall', caption:'Afternoon, in passing', year:'2020'},
  wall: {src:brooklyn4, alt:'A brick industrial wall, yellow bollards, and a keep-out sign', caption:'Keep out', year:'2020'},
  green: {src:brooklyn5, alt:'A green building behind a fence, in strong afternoon light', caption:'Between the lines', year:'2020'},
  road: {src:brooklyn6, alt:'A red tractor trailer parked beside a Brooklyn road', caption:'Red, white & blue', year:'2020'},
  joe: {src:old1, alt:'Black-and-white portrait of Joe seated with photocopied pages in his jacket', caption:'Joe', year:'c. 2000'},
  vera: {src:old2, alt:'Black-and-white portrait of Vera sitting on a rooftop', caption:'Vera', year:'c. 2000'},
  yoko: {src:old3, alt:'Black-and-white portrait of Yoko beside a subway station sign', caption:'Yoko', year:'c. 2000'},
};
export type PhotoKey = keyof typeof photos;
