import 'traceur/bin/traceur-runtime';
import {default as sample} from './lib/sample';

let call = function(num) {
  console.log(`calling func ${num}`);
  var ret = sample.func(num);
  console.log(`func ${num} returned ${ret}`);
  return ret;
};

let report = (s) => {
  console.log(`reporting: ${s}`);
};



call(0).then(report, (e) => { console.log(e.stack); });
call(1).then(report, console.log);
call(2).then(report, console.log);

for (let i = 3; i <= 20; i++) {
  call(i).then(report);
}

export {sample};
