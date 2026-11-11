import {isConversion, type Course} from './data';

export const extraCourseFields = {
  audience:{label:'Who Is This Course For?', hint:'Describe who would benefit and their experience level.'},
  inclusions:{label:'What’s Included', hint:'List the tuition, materials or extras covered by the fee.'},
  kit_options:{label:'Kit Options', hint:'Say what is provided in class, what students keep and what to bring.'},
  progression:{label:'Where Can This Course Lead?', hint:'Suggest the skills students can build on or their next course.'},
} as const;

// Both the public detail page and the staff editor select from courses AS c.
export const courseInformationColumns = Object.keys(extraCourseFields).map(name =>
  `(SELECT value FROM settings WHERE id='course-info:${name}:'||c.id) AS ${name}`
).join(', ');

const nextSteps:Record<string,string> = {
  'gel-foundations':'Practise a complete gel polish service, from nail preparation to safe removal. When you feel confident with application, explore nail art techniques.',
  'builder-gel':'Build on your gel polish skills by practising structured overlays, infills and maintenance on natural nails.',
  'nail-art':'Use the designs you practise in class to build a nail art portfolio or a design menu for clients.',
  'bdba3ef1-ee4b-4bd2-9c46-7c1886e371b5':'Practise constructing, shaping and maintaining acrylic enhancements as you work through your case studies.',
  'f34bb22b-697f-4be7-806a-ea8a6fc69f56':'Build on your existing nail qualification by developing builder gel overlay and maintenance services.',
  '7fed4d8e-8b53-4834-b2c7-7df0f8583fbc':'Build on your existing nail qualification by developing acrylic enhancement and maintenance services.',
};

export function courseInformationDefaults(course:Course) {
  // Earlier courses stored kit terms alongside entry requirements. Keep Carla’s wording,
  // including whether products are for classroom use or part of a take-home kit.
  const paragraphs=(course.requirements||'').split(/\r?\n\s*\r?\n/);
  const kitNotes=paragraphs.filter(paragraph=>/\b(kit|equipment|tools)\b/i.test(paragraph)
    && !/^\s*(equipment provided|entry requirements)\s*:?\s*$/i.test(paragraph));
  const includedEquipment=kitNotes.find(note=>/\b(included|provided|will receive)\b/i.test(note));
  const audience=isConversion(course)?'For qualified nail technicians who want to extend their existing skills.':
    course.level==='Beginner'?'For beginners. No previous experience is needed.':
    course.level==='Intermediate'?'For students with some nail training or practical experience.':'';
  return {
    audience,
    inclusions:[course.format==='online'?'':'In-person training with Carla at Savannah Sky Training Academy.',includedEquipment].filter(Boolean).join('\n\n'),
    kit_options:kitNotes.join('\n\n'),
    progression:nextSteps[course.id]||'',
  };
}
