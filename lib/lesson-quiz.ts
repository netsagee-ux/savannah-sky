export type QuizQuestion = {question:string;options:string[];answer:number};
export type QuizRow = {question?:string|null;options?:string|null;answer?:number|null;quiz_json?:string|null};

export function validateQuiz(value:unknown):QuizQuestion[]{
  if(!Array.isArray(value)||value.length>50)throw Error('Choose up to 50 questions per lesson.');
  return value.map((entry,index)=>{
    const prompt=typeof entry?.question==='string'?entry.question.trim():'';
    const options=Array.isArray(entry?.options)?entry.options.map((v:unknown)=>typeof v==='string'?v.trim():''):[];
    if(!prompt||prompt.length>500||options.length<2||options.length>6||
      options.some((v:string)=>!v||v.length>300)||!Number.isInteger(entry.answer)||entry.answer<0||entry.answer>=options.length)
      throw Error('Check question '+(index+1)+': add a question, fill each answer option and select the correct answer.');
    return {question:prompt,options,answer:entry.answer};
  });
}

export function readQuiz(row:QuizRow|null):QuizQuestion[]{
  if(row?.quiz_json)return validateQuiz(JSON.parse(row.quiz_json));
  if(!row?.question)return [];
  return validateQuiz([{question:row.question,options:JSON.parse(row.options||'[]'),answer:row.answer}]);
}
