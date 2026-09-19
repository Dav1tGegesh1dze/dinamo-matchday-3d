// PLACEHOLDER questions until the club supplies real ones.
// Each pool: ~3 questions. `correct` is the index into the original `answers` array (same for ka and en).
export const COUNTDOWN_SECONDS = [20, 15, 12, 10]; // index = stage - 1

export const questions = {
  easy: [
    {
      ka: { text: 'რომელ წელს დაარსდა დინამო თბილისი?', answers: ['1925', '1930', '1936', '1945'] },
      en: { text: 'In which year was Dinamo Tbilisi founded?', answers: ['1925', '1930', '1936', '1945'] },
      correct: 0,
    },
    {
      ka: { text: 'რა ფერია დინამოს ფორმა?', answers: ['წითელი', 'ლურჯ-თეთრი', 'მწვანე', 'ყვითელი'] },
      en: { text: 'What colour is the Dinamo kit?', answers: ['Red', 'Blue and white', 'Green', 'Yellow'] },
      correct: 1,
    },
    {
      ka: { text: 'რომელ ქალაქშია დინამოს სტადიონი?', answers: ['ბათუმი', 'ქუთაისი', 'თბილისი', 'რუსთავი'] },
      en: { text: 'In which city is the Dinamo stadium?', answers: ['Batumi', 'Kutaisi', 'Tbilisi', 'Rustavi'] },
      correct: 2,
    },
  ],
  medium: [
    {
      ka: { text: 'რომელ წელს მოიგო დინამომ თასების მფლობელთა თასი?', answers: ['1979', '1981', '1983', '1985'] },
      en: { text: 'In which year did Dinamo win the Cup Winners’ Cup?', answers: ['1979', '1981', '1983', '1985'] },
      correct: 1,
    },
    {
      ka: { text: 'ვის სახელს ატარებს დინამოს სტადიონი?', answers: ['ბორის პაიჭაძე', 'მიხეილ მესხი', 'დავით კიპიანი', 'რამაზ შენგელია'] },
      en: { text: 'Whose name does the Dinamo stadium carry?', answers: ['Boris Paichadze', 'Mikheil Meskhi', 'David Kipiani', 'Ramaz Shengelia'] },
      correct: 0,
    },
    {
      ka: { text: 'რომელ ქალაქში გაიმართა 1981 წლის ფინალი?', answers: ['დიუსელდორფი', 'მადრიდი', 'ლონდონი', 'რომი'] },
      en: { text: 'In which city was the 1981 final played?', answers: ['Düsseldorf', 'Madrid', 'London', 'Rome'] },
      correct: 0,
    },
  ],
  hard: [
    {
      ka: { text: 'ვინ იყო დინამოს მწვრთნელი 1981 წელს?', answers: ['ნოდარ ახალკაცი', 'დავით კიპიანი', 'გავრიილ კაჩალინი', 'ალექსანდრე ჩივაძე'] },
      en: { text: 'Who coached Dinamo in 1981?', answers: ['Nodar Akhalkatsi', 'David Kipiani', 'Gavriil Kachalin', 'Aleksandre Chivadze'] },
      correct: 0,
    },
    {
      ka: { text: 'რომელ გუნდს მოუგო დინამომ 1981 წლის ფინალში?', answers: ['კარლ ცაის იენა', 'ვესტ ჰემი', 'ფეიენორდი', 'ბენფიკა'] },
      en: { text: 'Whom did Dinamo beat in the 1981 final?', answers: ['Carl Zeiss Jena', 'West Ham', 'Feyenoord', 'Benfica'] },
      correct: 0,
    },
    {
      ka: { text: 'რომელ წელს მოიგო დინამომ საბჭოთა კავშირის ჩემპიონატი პირველად?', answers: ['1964', '1970', '1978', '1960'] },
      en: { text: 'When did Dinamo first win the Soviet championship?', answers: ['1964', '1970', '1978', '1960'] },
      correct: 0,
    },
  ],
  hardest: [
    {
      ka: { text: 'რა ანგარიშით დასრულდა 1981 წლის ფინალი?', answers: ['2:1', '1:0', '3:2', '2:0'] },
      en: { text: 'What was the score in the 1981 final?', answers: ['2:1', '1:0', '3:2', '2:0'] },
      correct: 0,
    },
    {
      ka: { text: 'ვინ გაიტანა გამარჯვების გოლი 1981 წლის ფინალში?', answers: ['ვიტალი დარასელია', 'რამაზ შენგელია', 'ვლადიმერ გუცაევი', 'დავით კიპიანი'] },
      en: { text: 'Who scored the winner in the 1981 final?', answers: ['Vitaly Daraselia', 'Ramaz Shengelia', 'Vladimir Gutsaev', 'David Kipiani'] },
      correct: 0,
    },
    {
      ka: { text: 'რამდენჯერ მოიგო დინამომ საბჭოთა კავშირის თასი?', answers: ['2', '1', '3', '4'] },
      en: { text: 'How many times did Dinamo win the Soviet Cup?', answers: ['2', '1', '3', '4'] },
      correct: 0,
    },
  ],
};

export const POOL_BY_STAGE = ['easy', 'medium', 'hard', 'hardest'];
