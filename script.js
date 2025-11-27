// ต้องใส่ API Key ของ Gemini ที่นี่
const API_KEY = 'AIzaSyCWq_N4Eq6vhWZj8FvyvTL6RZ1CfoAlBO0';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function validateQuestionCount() {
    const questionCount = document.getElementById('questionCount');
    const errorDiv = document.getElementById('questionCountError');
    const count = parseInt(questionCount.value);

    if (isNaN(count) || count < 1 || count > 1000) {
        errorDiv.textContent = 'กรุณาระบุจำนวนข้อสอบระหว่าง 1-1000 ข้อ';
        errorDiv.classList.remove('hidden');
        questionCount.classList.add('validation-error');
        return false;
    }

    errorDiv.classList.add('hidden');
    questionCount.classList.remove('validation-error');
    return true;
}

// เพิ่มฟังก์ชันจัดการข้อผิดพลาด
class ExamError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'ExamError';
        this.code = code;
    }
}

// ปรับปรุงฟังก์ชัน showError
function showError(error) {
    const errorMessages = {
        'API_ERROR': 'ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาลองใหม่อีกครั้ง',
        'VALIDATION_ERROR': 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่',
        'GENERATION_ERROR': 'ไม่สามารถสร้างข้อสอบได้ กรุณาลองใหม่',
        'FORMAT_ERROR': 'รูปแบบข้อสอบไม่ถูกต้อง กรุณาลองใหม่'
    };

    const message = error.code ? errorMessages[error.code] || error.message : error;
    const retryButton = error.code !== 'VALIDATION_ERROR' ? 
        `<button onclick="retryGeneration()" class="retry-btn">
            <i class="fas fa-redo"></i> ลองใหม่
        </button>` : '';

    document.getElementById('examResult').innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
            ${retryButton}
        </div>
    `;
}

// ปรับปรุงฟังก์ชัน generateExam
async function generateExam() {
    try {
        // ตรวจสอบข้อมูลพื้นฐาน
        const subject = document.getElementById('subject').value.trim();
        const level = document.getElementById('grade').value;
        const questionCount = parseInt(document.getElementById('questionCount').value);

        if (!subject || !level) {
            throw new ExamError('กรุณากรอกข้อมูลให้ครบถ้วน', 'VALIDATION_ERROR');
        }

        // แสดงสถานะกำลังโหลด
        document.getElementById('loadingSpinner').classList.remove('hidden');
        document.getElementById('examResult').innerHTML = '';
        document.getElementById('examControls').classList.add('hidden');

        // สร้างข้อสอบทีละชุด
        const questionsPerBatch = 5;
        const batchCount = Math.ceil(questionCount / questionsPerBatch);
        let allQuestions = [];
        
        for (let i = 0; i < batchCount; i++) {
            const remainingQuestions = questionCount - (i * questionsPerBatch);
            const currentBatchSize = Math.min(remainingQuestions, questionsPerBatch);
            const startNumber = i * questionsPerBatch + 1;

            try {
                const batchQuestions = await generateQuestionBatch(
                    subject, 
                    level, 
                    currentBatchSize, 
                    startNumber
                );
                
                if (!batchQuestions || batchQuestions.length === 0) {
                    throw new ExamError('ไม่สามารถสร้างข้อสอบได้', 'GENERATION_ERROR');
                }

                allQuestions = [...allQuestions, ...batchQuestions];
                
                // อัพเดทสถานะ
                document.getElementById('loadingSpinner').innerHTML = `
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>กำลังสร้างข้อสอบ... (${allQuestions.length}/${questionCount} ข้อ)</p>
                `;
            } catch (error) {
                console.error('Batch generation error:', error);
                throw new ExamError('เกิดข้อผิดพลาดในการสร้างข้อสอบ', 'GENERATION_ERROR');
            }
        }

        // ตรวจสอบจำนวนข้อสอบ
        if (allQuestions.length !== questionCount) {
            throw new ExamError(
                `จำนวนข้อสอบไม่ตรงตามที่ต้องการ (${allQuestions.length}/${questionCount} ข้อ)`,
                'GENERATION_ERROR'
            );
        }

        // แสดงข้อสอบ
        const formattedExam = formatExam(allQuestions.join('\n\n'));
        document.getElementById('examResult').innerHTML = formattedExam;
        document.getElementById('examControls').classList.remove('hidden');

    } catch (error) {
        console.error('Generation error:', error);
        showError(error);
    } finally {
        document.getElementById('loadingSpinner').classList.add('hidden');
    }
}

// เพิ่มฟังก์ชันใหม่สำหรับสร้างข้อสอบแต่ละชุด
async function generateQuestionBatch(subject, level, batchSize, startNumber) {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const prompt = `สร้างข้อสอบวิชา${subject} ระดับ${level} จำนวน ${batchSize} ข้อ
เริ่มจากข้อที่ ${startNumber} โดยใช้รูปแบบต่อไปนี้อย่างเคร่งครัด และห้ามใส่ข้อความอื่นเพิ่มเติม:

${startNumber}. [คำถาม]
ก. [ตัวเลือก]
ข. [ตัวเลือก]
ค. [ตัวเลือก]
ง. [ตัวเลือก]
เฉลย: [ก/ข/ค/ง]`;

            const response = await fetch(`${API_URL}?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2000,
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!generatedText) {
                throw new Error('ไม่ได้รับข้อมูลจาก API');
            }

            const questions = generatedText.split(/(?=\d+\.)/).filter(q => q.trim());
            
            if (!validateBatchFormat(questions, batchSize)) {
                throw new Error('รูปแบบข้อสอบไม่ถูกต้อง');
            }

            return questions;

        } catch (error) {
            console.error(`Attempt ${attempt + 1} failed:`, error);
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    throw new ExamError(
        `ไม่สามารถสร้างข้อสอบได้หลังจากลองซ้ำ ${maxRetries} ครั้ง: ${lastError.message}`,
        'GENERATION_ERROR'
    );
}

// เพิ่มฟังก์ชันตรวจสอบรูปแบบข้อสอบแต่ละชุด
function validateBatchFormat(questions, expectedCount) {
    if (questions.length !== expectedCount) {
        return false;
    }

    return questions.every(question => {
        const lines = question.split('\n').filter(line => line.trim());
        const hasQuestion = lines[0]?.match(/^\d+\./);
        const options = lines.filter(line => /^[ก-ง]\./.test(line.trim()));
        const hasAnswer = lines.some(line => /เฉลย:\s*[ก-ง]/i.test(line));

        return hasQuestion && options.length === 4 && hasAnswer;
    });
}

// เพิ่มฟังก์ชัน retry
function retryGeneration() {
    document.getElementById('examResult').innerHTML = '';
    generateExam();
}

function showError(message) {
    document.getElementById('examResult').innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
        </div>
    `;
}

let correctAnswers = [];
let hasSubmitted = false;

function formatExam(examContent) {
    const questions = examContent.split(/(?=\d+\.)/).filter(q => q.trim());
    correctAnswers = [];

    return questions.map((question, index) => {
        const lines = question.split('\n').filter(line => line.trim());
        const questionText = lines[0].replace(/^\d+\.\s*/, '');
        
        // แยกตัวเลือก
        const options = lines.filter(line => /^[ก-ง]\./.test(line.trim()));
        
        // หาเฉลย
        const answerLine = lines.find(line => /เฉลย:\s*[ก-ง]/i.test(line));
        if (answerLine) {
            const answer = answerLine.match(/เฉลย:\s*([ก-ง])/i)[1];
            correctAnswers[index] = answer;
        }

        return `
            <div class="question-card" id="question-${index}">
                <div class="question-header">
                    <span class="question-number">ข้อที่ ${index + 1}</span>
                </div>
                <div class="question-text">
                    ${questionText}
                </div>
                <ul class="option-list" id="options-${index}">
                    ${options.map(option => {
                        const [label, ...text] = option.split(/\.\s*/);
                        return `
                            <li class="option-item" onclick="selectOption(${index}, '${label}')" 
                                data-question="${index}" data-option="${label}">
                                <span class="option-label">${label}.</span>
                                <span class="option-text">${text.join('.').trim()}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        `;
    }).join('');
}

function selectOption(questionIndex, option) {
    const optionsList = document.querySelectorAll(`#options-${questionIndex} .option-item`);
    optionsList.forEach(item => {
        item.classList.remove('selected');
    });
    const selectedOption = document.querySelector(`#options-${questionIndex} [data-option="${option}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
}

function submitExam() {
    if (!validateAllAnswered()) {
        alert('กรุณาตอบคำถามให้ครบทุกข้อ');
        return;
    }

    const totalQuestions = correctAnswers.length;
    let score = 0;
    let userAnswers = [];

    for (let i = 0; i < totalQuestions; i++) {
        const selectedOption = document.querySelector(`#options-${i} .selected`);
        if (selectedOption) {
            const userAnswer = selectedOption.getAttribute('data-option');
            userAnswers[i] = userAnswer;
            if (userAnswer === correctAnswers[i]) {
                score++;
            }
        }
    }

    const percentage = (score / totalQuestions) * 100;
    document.getElementById('scoreDisplay').innerHTML = `
        <div class="score-summary">
            <h3>คะแนนรวม: ${score}/${totalQuestions} (${percentage.toFixed(2)}%)</h3>
        </div>
    `;

    document.getElementById('scoreResult').classList.remove('hidden');
    document.getElementById('submitBtn').disabled = true;
    hasSubmitted = true;
}

function validateAllAnswered() {
    const totalQuestions = correctAnswers.length;
    for (let i = 0; i < totalQuestions; i++) {
        if (!document.querySelector(`#options-${i} .selected`)) {
            return false;
        }
    }
    return true;
}

function displayResults(score, total, percentage, results) {
    const wrongAnswers = results.filter(r => !r.isCorrect).map(r => r.questionNum);
    
    document.getElementById('scoreDisplay').innerHTML = `
        <div class="score-summary">
            <div class="score-header">
                <h3>คะแนนรวม: ${score}/${total} (${percentage.toFixed(2)}%)</h3>
            </div>
            <div class="score-details">
                <p>✓ ตอบถูก: ${score} ข้อ</p>
                <p>✗ ตอบผิด: ${total - score} ข้อ</p>
                ${wrongAnswers.length > 0 ? 
                    `<p>ข้อที่ตอบผิด: ${wrongAnswers.join(', ')}</p>` : 
                    '<p class="perfect-score">✨ ยินดีด้วย! คุณตอบถูกทุกข้อ</p>'}
            </div>
        </div>
    `;
    
    document.getElementById('scoreResult').classList.remove('hidden');
}

function showAnswers() {
    if (!hasSubmitted) return;

    correctAnswers.forEach((correctAnswer, index) => {
        const options = document.querySelectorAll(`#options-${index} .option-item`);
        const selectedOption = document.querySelector(`#options-${index} .selected`);

        options.forEach(option => {
            const optionValue = option.getAttribute('data-option');
            
            // ลบ markers เก่า (ถ้ามี)
            const existingMarker = option.querySelector('.answer-marker');
            if (existingMarker) existingMarker.remove();

            if (optionValue === correctAnswer) {
                option.classList.add('correct');
                option.insertAdjacentHTML('beforeend', 
                    '<span class="answer-marker correct">✓ เฉลย</span>');
            } else if (option === selectedOption) {
                if (optionValue !== correctAnswer) {
                    option.classList.add('incorrect');
                    option.insertAdjacentHTML('beforeend', 
                        '<span class="answer-marker incorrect">✗</span>');
                }
            }
        });
    });

    // ปิดปุ่มดูเฉลย
    document.querySelector('.show-answers-btn').disabled = true;
}

function resetExam() {
    document.querySelectorAll('.option-item').forEach(item => {
        item.classList.remove('selected', 'correct', 'incorrect');
        const marker = item.querySelector('.answer-marker');
        if (marker) marker.remove();
    });
    
    document.getElementById('scoreResult').classList.add('hidden');
    document.getElementById('submitBtn').disabled = false;
    document.querySelector('.show-answers-btn').disabled = false;
    hasSubmitted = false;
}

function printExam() {
    window.print();
}

function validateExam(examContent) {
    // ตรวจสอบว่ามีเนื้อหาข้อสอบหรือไม่
    if (!examContent || examContent.trim() === '') {
        throw new Error('ไม่พบเนื้อหาข้อสอบ');
    }

    const questions = examContent.split(/(?=^\d+\.)/).filter(q => q.trim());
    const requiredQuestionCount = document.getElementById('questionCount').value;

    // ตรวจสอบจำนวนข้อ
    if (questions.length !== parseInt(requiredQuestionCount)) {
        throw new Error(`จำนวนข้อสอบไม่ตรงตามที่กำหนด (ต้องการ ${requiredQuestionCount} ข้อ, ได้ ${questions.length} ข้อ)`);
    }

    // ตรวจสอบแต่ละข้อ
    questions.forEach((question, index) => {
        const lines = question.split('\n').map(line => line.trim()).filter(line => line);
        
        // ตรวจสอบคำถาม
        if (!lines[0] || !lines[0].match(/^\d+\./)) {
            throw new Error(`ข้อที่ ${index + 1} ไม่มีคำถาม`);
        }

        // ตรวจสอบตัวเลือก
        const choices = lines.filter(line => /^[ก-ง]\./.test(line));
        if (choices.length !== 4) {
            throw new Error(`ข้อที่ ${index + 1} มีตัวเลือกไม่ครบ 4 ตัวเลือก`);
        }

        // ตรวจสอบเฉลย
        const answerLine = lines.find(line => /เฉลย:\s*[ก-ง]/i.test(line));
        if (!answerLine) {
            throw new Error(`ข้อที่ ${index + 1} ไม่มีเฉลย`);
        }
    });

    return true;
}

function validateExamFormat(content, expectedCount) {
    // ตัดข้อความว่างต้นและท้าย
    content = content.trim();
    
    // แยกข้อสอบแต่ละข้อ
    const questions = content.split(/(?=\d+\.)/).filter(q => q.trim());
    
    // ตรวจสอบจำนวนข้อ
    if (questions.length !== expectedCount) {
        console.error(`จำนวนข้อสอบไม่ตรงกับที่ต้องการ: ${questions.length}/${expectedCount}`);
        return false;
    }

    // ตรวจสอบแต่ละข้อ
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i].trim();
        
        // ตรวจสอบเลขข้อ
        if (!q.match(new RegExp(`^${i + 1}\\.`))) {
            console.error(`ข้อ ${i + 1}: เลขข้อไม่ถูกต้อง`);
            return false;
        }

        // ตรวจสอบตัวเลือก
        const options = q.match(/[ก-ง]\./g);
        if (!options || options.length !== 4) {
            console.error(`ข้อ ${i + 1}: ตัวเลือกไม่ครบ 4 ตัวเลือก`);
            return false;
        }

        // ตรวจสอบเฉลย
        if (!q.match(/เฉลย:\s*[ก-ง]/)) {
            console.error(`ข้อ ${i + 1}: ไม่พบเฉลยหรือรูปแบบเฉลยไม่ถูกต้อง`);
            return false;
        }
    }

    return true;
}

function validateExamContent(content, subject) {
    // ตรวจสอบว่าเนื้อหาเกี่ยวข้องกับวิชาที่เลือก
    const questions = content.split(/(?=\d+\.)/).filter(q => q.trim());
    const subjectKeywords = getSubjectKeywords(subject);
    
    return questions.every(question => {
        return subjectKeywords.some(keyword => 
            question.toLowerCase().includes(keyword.toLowerCase())
        );
    });
}

function getSubjectKeywords(subject) {
    // คำสำคัญที่เกี่ยวข้องกับแต่ละวิชา
    const keywords = {
        'คณิตศาสตร์': ['คำนวณ', 'จำนวน', 'บวก', 'ลบ', 'คูณ', 'หาร', 'เรขาคณิต', 'สมการ'],
        'ภาษาไทย': ['คำ', 'ประโยค', 'ความหมาย', 'อ่าน', 'เขียน', 'วรรณคดี', 'ภาษา'],
        'ภาษาอังกฤษ': ['vocabulary', 'grammar', 'reading', 'writing', 'speaking', 'english'],
        'วิทยาศาสตร์': ['ทดลอง', 'ธรรมชาติ', 'สิ่งมีชีวิต', 'พลังงาน', 'สสาร', 'แรง']
    };

    const defaultKeywords = [subject];
    return keywords[subject] || defaultKeywords;
}

function getSubjectPrompt(subject, level) {
    const prompts = {
        'คณิตศาสตร์': `วิชาคณิตศาสตร์เกี่ยวกับการคำนวณ การแก้โจทย์ปัญหา สมการ เรขาคณิต ระดับ${level}`,
        'ภาษาไทย': `วิชาภาษาไทยเกี่ยวกับหลักภาษา การใช้ภาษา วรรณคดี วรรณกรรม ระดับ${level}`,
        'ภาษาอังกฤษ': `วิชาภาษาอังกฤษเกี่ยวกับ grammar, vocabulary, reading comprehension ระดับ${level}`,
        'วิทยาศาสตร์': `วิชาวิทยาศาสตร์เกี่ยวกับปรากฏการณ์ธรรมชาติ การทดลอง สิ่งมีชีวิต พลังงาน ระดับ${level}`
    };
    return prompts[subject] || `วิชา${subject} ระดับ${level}`;
}

function validateSubjectContent(content, subject) {
    const keywords = {
        'คณิตศาสตร์': ['คำนวณ', 'บวก', 'ลบ', 'คูณ', 'หาร', 'จำนวน', 'สมการ', 'เรขาคณิต'],
        'ภาษาไทย': ['ภาษา', 'คำ', 'ประโยค', 'วรรณคดี', 'วรรณกรรม', 'ความหมาย'],
        'ภาษาอังกฤษ': ['english', 'grammar', 'vocabulary', 'reading', 'meaning'],
        'วิทยาศาสตร์': ['ทดลอง', 'ธรรมชาติ', 'สิ่งมีชีวิต', 'พลังงาน', 'แรง']
    };

    const subjectKeywords = keywords[subject] || [subject];
    const contentLower = content.toLowerCase();
    
    // ตรวจสอบว่ามีคำสำคัญของวิชาอยู่ในเนื้อหาหรือไม่
    return subjectKeywords.some(keyword => 
        contentLower.includes(keyword.toLowerCase())
    );
}

// Add event listener for input validation
document.getElementById('questionCount').addEventListener('input', validateQuestionCount);
