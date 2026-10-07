import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows } from '../theme/theme';
import { useAppStore } from '../store/AppStore';
import { AppIcon, IconButton, PrimaryButton, SectionTitle, Surface } from '../components/Ui';
import { Quiz } from '../types';
import { formatDate } from '../utils/text';

export const QuizScreen = ({ onOpenDrawer }: { onOpenDrawer: () => void }) => {
  const { data, createQuiz } = useAppStore();
  const [selectedQuizId, setSelectedQuizId] = useState<string>();
  const selectedQuiz = data.quizzes.find((quiz) => quiz.id === selectedQuizId);

  if (selectedQuiz) return <QuizDetail quiz={selectedQuiz} onBack={() => setSelectedQuizId(undefined)} />;

  return (
    <View style={styles.screen}>
      <View style={styles.header}><IconButton icon="menu" onPress={onOpenDrawer} color={colors.text} accessibilityLabel="Open menu" /><View style={{ flex: 1 }}><Text style={styles.kicker}>PRACTICE WHAT YOU KNOW</Text><Text style={styles.title}>Quizzes</Text></View><IconButton icon="options-outline" onPress={() => Alert.alert('Quiz preferences', 'Question count, difficulty, and question types will be configured here.')} color={colors.textMuted} accessibilityLabel="Quiz preferences" /></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Surface style={styles.hero}><View style={styles.heroIcon}><AppIcon name="school" size={27} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.heroTitle}>Turn notes into momentum</Text><Text style={styles.heroBody}>Generate practice questions from the notes already on your device.</Text></View><Pressable onPress={() => createQuiz()} style={styles.heroButton}><AppIcon name="add" size={20} color="#FFFFFF" /></Pressable></Surface>
        <SectionTitle eyebrow="YOUR PROGRESS" title="Study sets" action={<Text style={styles.count}>{data.quizzes.length} total</Text>} />
        {data.quizzes.length ? data.quizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} onPress={() => setSelectedQuizId(quiz.id)} />) : <View style={styles.empty}><View style={styles.emptyIcon}><AppIcon name="sparkles" size={26} color={colors.primary} /></View><Text style={styles.emptyTitle}>No quizzes yet</Text><Text style={styles.emptyBody}>Create one from your local notes whenever you are ready to test your understanding.</Text><PrimaryButton label="Generate a quiz" icon="sparkles" onPress={() => createQuiz()} /></View>}
      </ScrollView>
    </View>
  );
};

const QuizCard = ({ quiz, onPress }: { quiz: Quiz; onPress: () => void }) => (
  <Pressable onPress={onPress} style={styles.quizCard}><View style={styles.quizIcon}><AppIcon name="brain" size={21} color={colors.purple} /></View><View style={{ flex: 1 }}><Text style={styles.quizTitle}>{quiz.title}</Text><Text style={styles.quizMeta}>{quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'} · {quiz.difficulty} · {formatDate(quiz.createdAt)}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${quiz.lastScore ? Math.round(quiz.lastScore * 100) : 0}%` }]} /></View></View><AppIcon name="chevron-forward" size={18} color={colors.textFaint} /></Pressable>
);

const QuizDetail = ({ quiz, onBack }: { quiz: Quiz; onBack: () => void }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = useMemo(() => quiz.questions.filter((question) => answers[question.id] === question.answer).length, [answers, quiz.questions]);

  return (
    <View style={styles.screen}><View style={styles.header}><IconButton icon="arrow-back" onPress={onBack} color={colors.text} accessibilityLabel="Back to quizzes" /><View style={{ flex: 1 }}><Text style={styles.kicker}>STUDY SET</Text><Text style={styles.title}>{quiz.title}</Text></View><View style={styles.difficulty}><Text style={styles.difficultyText}>{quiz.difficulty}</Text></View></View><ScrollView contentContainerStyle={styles.quizContent}>{submitted && <View style={styles.result}><AppIcon name="trophy" size={26} color={colors.peach} /><View><Text style={styles.resultTitle}>Nice work — {score}/{quiz.questions.length}</Text><Text style={styles.resultBody}>Review the answers below and try again whenever you like.</Text></View></View>}{quiz.questions.map((question, index) => <View key={question.id} style={styles.questionCard}><Text style={styles.questionNumber}>QUESTION {index + 1}</Text><Text style={styles.questionPrompt}>{question.prompt}</Text>{question.options.map((option) => { const selected = answers[question.id] === option; const correct = submitted && option === question.answer; const incorrect = submitted && selected && !correct; return <Pressable key={option} onPress={() => !submitted && setAnswers((current) => ({ ...current, [question.id]: option }))} style={[styles.option, selected && styles.optionSelected, correct && styles.optionCorrect, incorrect && styles.optionIncorrect]}><Text style={styles.optionText}>{option}</Text>{(selected || correct) && <AppIcon name={correct ? 'checkmark-circle' : 'radio-button-on'} size={18} color={correct ? colors.success : colors.primary} />}</Pressable>; })}</View>)}<PrimaryButton label={submitted ? 'Try again' : 'Check answers'} onPress={() => { if (submitted) { setAnswers({}); setSubmitted(false); } else setSubmitted(true); }} icon={submitted ? 'refresh' : 'checkmark'} /></ScrollView></View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 13, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  kicker: { color: colors.primary, fontWeight: '800', letterSpacing: 1, fontSize: 9 },
  title: { color: colors.text, fontSize: 23, fontWeight: '800', marginTop: 2 },
  content: { padding: 16, paddingBottom: 36 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, marginBottom: 27, backgroundColor: '#F0EEFF' },
  heroIcon: { width: 47, height: 47, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  heroBody: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  heroButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  count: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  quizCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radii.md, padding: 14, marginBottom: 10, ...shadows },
  quizIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#F1EBFF', alignItems: 'center', justifyContent: 'center' },
  quizTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  quizMeta: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  progressTrack: { height: 5, borderRadius: 4, backgroundColor: colors.surfaceMuted, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  empty: { alignItems: 'center', paddingVertical: 55 },
  emptyIcon: { width: 60, height: 60, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 14 },
  emptyBody: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6, maxWidth: 300 },
  difficulty: { backgroundColor: colors.primarySoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  difficultyText: { color: colors.primaryDark, fontSize: 10, fontWeight: '800' },
  quizContent: { padding: 16, paddingBottom: 36 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.successSoft, borderRadius: radii.md, padding: 14, marginBottom: 15 },
  resultTitle: { color: colors.success, fontSize: 15, fontWeight: '800' },
  resultBody: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  questionCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 17, marginBottom: 14, ...shadows },
  questionNumber: { color: colors.primary, fontSize: 10, letterSpacing: 1, fontWeight: '900' },
  questionPrompt: { color: colors.text, fontSize: 18, lineHeight: 25, fontWeight: '800', marginTop: 9, marginBottom: 15 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 13, marginTop: 8 },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft },
  optionIncorrect: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  optionText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
});
