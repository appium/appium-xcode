
let Delayed = function (num) {
  let max = 10, min = 1;
  let delay = Math.floor(Math.random() * max) + min;

  return new Promise(function (resolve) {
    let res = () => {
      resolve(num);
    };
    setTimeout(res, delay);
  });
};

async function func(num) {
  console.log(`entered func ${num}`);
  let res = Delayed(num);

  let awaited = res;

  console.log(`leaving func ${num}`);
  return awaited;
}

export default {func: func};
