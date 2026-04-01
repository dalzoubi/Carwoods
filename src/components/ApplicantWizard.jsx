import React, { useState, useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Tune from '@mui/icons-material/Tune';
import { useTheme, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import {
    PersonalizeCard,
    PersonalizeCardText,
    PersonalizeCardTitle,
    PersonalizeCardDesc,
    PersonalizeCardButton,
    FilterBanner,
    FilterBannerText,
    FilterBannerLabel,
    FilterBannerChips,
    FilterBannerActions,
    FilterBannerEditButton,
    FilterBannerResetButton,
} from '../styles';

const STORAGE_KEY = 'carwoods_applicant_profile';

// Structural question definitions — no display strings; those come from translations.
const QUESTIONS = [
    {
        key: 'employment',
        multi: false,
        optionValues: ['employed', 'self-employed', 'both', 'not-employed'],
    },
    {
        key: 'hasPets',
        multi: false,
        optionValues: ['none', 'pets', 'service', 'esa'],
    },
    {
        key: 'benefits',
        multi: true,
        noneValue: 'none',
        optionValues: ['none', 'va', 'ssa-ssi', 'ssdi', 'retirement', 'child-support', 'other-benefits'],
    },
    {
        key: 'section8',
        multi: false,
        optionValues: ['no', 'yes'],
    },
    {
        key: 'guarantorCosigner',
        multi: false,
        optionValues: ['neither', 'guarantor', 'cosigner', 'not-sure'],
    },
    {
        key: 'creditScore',
        multi: false,
        optionValues: ['unknown', '650-above', 'below-650'],
    },
];

// Maps option value strings to their translation key suffix (camelCase).
const OPTION_VALUE_TO_KEY = {
    'self-employed': 'selfEmployed',
    'not-employed': 'notEmployed',
    'ssa-ssi': 'ssaSsi',
    'child-support': 'childSupport',
    'other-benefits': 'otherBenefits',
    'not-sure': 'notSure',
    '650-above': 'above650',
    'below-650': 'below650',
};

function optionKey(value) {
    return OPTION_VALUE_TO_KEY[value] ?? value;
}

function getLocalizedQuestions(t) {
    return QUESTIONS.map(q => ({
        ...q,
        question: t(`wizard.questions.${q.key}.question`),
        hint: q.key === 'benefits' ? t('wizard.questions.benefits.hint') : undefined,
        options: q.optionValues.map(value => ({
            value,
            label: t(`wizard.questions.${q.key}.options.${optionKey(value)}.label`),
            desc: t(`wizard.questions.${q.key}.options.${optionKey(value)}.desc`),
        })),
    }));
}

function loadProfile() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveProfile(profile) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
        // localStorage unavailable — degrade gracefully
    }
}

function clearProfile() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}

export function buildChipLabel(profile, t) {
    const parts = [];

    const empMap = {
        employed: t('wizard.chipLabel.employed'),
        'self-employed': t('wizard.chipLabel.selfEmployed'),
        both: t('wizard.chipLabel.employedBoth'),
        'not-employed': t('wizard.chipLabel.notEmployed'),
    };
    if (profile.employment && empMap[profile.employment]) parts.push(empMap[profile.employment]);

    const petsMap = {
        pets: t('wizard.chipLabel.pets'),
        service: t('wizard.chipLabel.serviceAnimal'),
        esa: t('wizard.chipLabel.esa'),
    };
    if (profile.hasPets && petsMap[profile.hasPets]) parts.push(petsMap[profile.hasPets]);

    const benefitMap = {
        va: t('wizard.chipLabel.va'),
        'ssa-ssi': t('wizard.chipLabel.ssaSsi'),
        ssdi: t('wizard.chipLabel.ssdi'),
        retirement: t('wizard.chipLabel.retirement'),
        'child-support': t('wizard.chipLabel.childSupport'),
        'other-benefits': t('wizard.chipLabel.otherBenefits'),
    };
    if (Array.isArray(profile.benefits)) {
        profile.benefits.filter(b => b !== 'none').forEach(b => { if (benefitMap[b]) parts.push(benefitMap[b]); });
    }

    if (profile.section8 === 'yes') parts.push(t('wizard.chipLabel.section8'));

    const gcMap = {
        guarantor: t('wizard.chipLabel.guarantor'),
        cosigner: t('wizard.chipLabel.cosigner'),
        'not-sure': t('wizard.chipLabel.guarantorUnsure'),
    };
    if (profile.guarantorCosigner && gcMap[profile.guarantorCosigner]) parts.push(gcMap[profile.guarantorCosigner]);

    const creditMap = {
        'below-650': t('wizard.chipLabel.creditBelow650'),
        unknown: t('wizard.chipLabel.creditUnknown'),
    };
    if (profile.creditScore && creditMap[profile.creditScore]) parts.push(creditMap[profile.creditScore]);

    return parts.length ? parts.join(' · ') : t('wizard.chipLabel.customFilters');
}

function getInitialAnswers(profile) {
    const answers = {};
    QUESTIONS.forEach(q => {
        if (profile && profile[q.key] !== undefined) {
            answers[q.key] = profile[q.key];
        } else {
            answers[q.key] = q.multi ? [] : null;
        }
    });
    return answers;
}

function mergeAnswerSelect(prev, key, value, multi, noneValue) {
    if (!multi) return { ...prev, [key]: value };
    const current = Array.isArray(prev[key]) ? prev[key] : [];
    if (noneValue && value === noneValue) {
        return { ...prev, [key]: current.includes(noneValue) ? [] : [noneValue] };
    }
    const withoutNone = current.filter(v => v !== noneValue);
    if (withoutNone.includes(value)) {
        return { ...prev, [key]: withoutNone.filter(v => v !== value) };
    }
    return { ...prev, [key]: [...withoutNone, value] };
}

const RadioOption = ({ option, selected, name, onSelect }) => {
    const theme = useTheme();
    const isSelected = selected === option.value;
    const primary = theme.palette.primary.main;
    const selectedBg = theme.palette.mode === 'dark' ? alpha(primary, 0.2) : alpha(primary, 0.12);
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.6rem 0.75rem',
                marginBottom: '0.375rem',
                borderRadius: `${theme.shape.borderRadius}px`,
                cursor: 'pointer',
                background: isSelected ? selectedBg : 'transparent',
                border: isSelected ? `1.5px solid ${primary}` : '1.5px solid transparent',
                transition: 'background 0.15s, border-color 0.15s',
            }}
        >
            <input
                type="radio"
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onSelect(option.value)}
                style={{ marginTop: '3px', accentColor: primary, flexShrink: 0 }}
            />
            <span>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem', color: theme.palette.text.primary }}>
                    {option.label}
                </span>
                {option.desc && (
                    <span style={{ display: 'block', fontSize: '0.875rem', color: theme.palette.text.secondary, marginTop: '2px' }}>
                        {option.desc}
                    </span>
                )}
            </span>
        </label>
    );
};

const OptionCard = ({ option, selected, multi, onSelect, tabIndex }) => {
    const theme = useTheme();
    const isSelected = multi
        ? Array.isArray(selected) && selected.includes(option.value)
        : selected === option.value;

    const primary = theme.palette.primary.main;
    const paper = theme.palette.background.paper;
    const selectedBg = theme.palette.mode === 'dark' ? alpha(primary, 0.18) : alpha(primary, 0.1);
    const borderDefault = theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.18) : '#d0d7e3';
    const indicatorBorder = isSelected ? primary : theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.35) : '#9aa5b4';
    const indicatorFill = isSelected ? primary : paper;
    const markColor = theme.palette.getContrastText(primary);

    return (
        <button
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={isSelected}
            tabIndex={tabIndex}
            onClick={() => onSelect(option.value)}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                width: '100%',
                textAlign: 'left',
                padding: '0.75rem 1rem',
                marginBottom: '0.5rem',
                background: isSelected ? selectedBg : paper,
                border: isSelected ? `2px solid ${primary}` : `1.5px solid ${borderDefault}`,
                borderRadius: `${theme.shape.borderRadius}px`,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                fontFamily: 'inherit',
                color: theme.palette.text.primary,
            }}
        >
            <span
                style={{
                    flexShrink: 0,
                    marginTop: '2px',
                    width: '18px',
                    height: '18px',
                    borderRadius: multi ? '4px' : '50%',
                    border: `2px solid ${indicatorBorder}`,
                    background: indicatorFill,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                aria-hidden="true"
            >
                {isSelected && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        {multi ? (
                            <path
                                d="M2 6l3 3 5-5"
                                stroke={markColor}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        ) : (
                            <circle cx="6" cy="6" r="3" fill={markColor} />
                        )}
                    </svg>
                )}
            </span>
            <span>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem', color: theme.palette.text.primary }}>
                    {option.label}
                </span>
                {option.desc && (
                    <span style={{ display: 'block', fontSize: '0.875rem', color: theme.palette.text.secondary, marginTop: '2px' }}>
                        {option.desc}
                    </span>
                )}
            </span>
        </button>
    );
};

const ApplicantWizard = ({ onProfileChange }) => {
    const theme = useTheme();
    const { t } = useTranslation();
    const [profile, setProfile] = useState(() => loadProfile());
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState(() => getInitialAnswers(loadProfile()));
    const [confirmResetOpen, setConfirmResetOpen] = useState(false);

    const latestAnswersRef = useRef(answers);
    latestAnswersRef.current = answers;
    const stepRef = useRef(step);
    stepRef.current = step;

    const hasFilters = profile !== null;

    const localizedQuestions = getLocalizedQuestions(t);

    const openWizard = useCallback(() => {
        const initial = getInitialAnswers(loadProfile());
        latestAnswersRef.current = initial;
        setAnswers(initial);
        setStep(0);
        setOpen(true);
    }, []);

    const closeWizard = useCallback(() => setOpen(false), []);

    const handleReset = useCallback(() => {
        clearProfile();
        setProfile(null);
        const cleared = getInitialAnswers(null);
        latestAnswersRef.current = cleared;
        setAnswers(cleared);
        setOpen(false);
        setConfirmResetOpen(false);
        if (onProfileChange) onProfileChange(null);
    }, [onProfileChange]);

    const requestReset = useCallback(() => setConfirmResetOpen(true), []);
    const cancelReset = useCallback(() => setConfirmResetOpen(false), []);

    const finishWizard = useCallback((answersSnapshot) => {
        const newProfile = {};
        QUESTIONS.forEach(q => {
            const val = answersSnapshot[q.key];
            const isEmpty = q.multi ? (!Array.isArray(val) || val.length === 0) : val === null;
            if (!isEmpty) newProfile[q.key] = val;
        });
        saveProfile(newProfile);
        setProfile(newProfile);
        setOpen(false);
        if (onProfileChange) onProfileChange(newProfile);
    }, [onProfileChange]);

    const handleMultiSelect = useCallback((key, value, noneValue) => {
        flushSync(() => {
            setAnswers(prev => {
                const next = mergeAnswerSelect(prev, key, value, true, noneValue);
                latestAnswersRef.current = next;
                return next;
            });
        });
        if (key !== 'benefits' || value !== noneValue) return;
        const arr = latestAnswersRef.current[key];
        const choseNoneOnly = Array.isArray(arr) && arr.length === 1 && arr[0] === noneValue;
        if (!choseNoneOnly) return;
        const qIndex = QUESTIONS.findIndex(q => q.key === key);
        if (qIndex === -1 || stepRef.current !== qIndex) return;
        if (qIndex < QUESTIONS.length - 1) {
            setStep(s => s + 1);
        } else {
            finishWizard(latestAnswersRef.current);
        }
    }, [finishWizard]);

    const handleNext = useCallback(() => {
        const snapshot = latestAnswersRef.current;
        if (step < QUESTIONS.length - 1) {
            setStep(s => s + 1);
        } else {
            finishWizard(snapshot);
        }
    }, [step, finishWizard]);

    const handleSingleSelectAndAdvance = useCallback((questionKey, value) => {
        flushSync(() => {
            setAnswers(prev => {
                const next = mergeAnswerSelect(prev, questionKey, value, false, undefined);
                latestAnswersRef.current = next;
                return next;
            });
        });
        const qIndex = QUESTIONS.findIndex(q => q.key === questionKey);
        if (qIndex === -1 || stepRef.current !== qIndex) return;
        if (qIndex < QUESTIONS.length - 1) {
            setStep(s => s + 1);
        } else {
            finishWizard(latestAnswersRef.current);
        }
    }, [finishWizard]);

    const handleBack = useCallback(() => setStep(s => s - 1), []);

    const handleSkip = useCallback(() => {
        const q = QUESTIONS[step];
        flushSync(() => {
            setAnswers(prev => {
                const next = { ...prev, [q.key]: q.multi ? [] : null };
                latestAnswersRef.current = next;
                return next;
            });
        });
        if (step < QUESTIONS.length - 1) {
            setStep(s => s + 1);
        } else {
            handleNext();
        }
    }, [step, handleNext]);

    const [focusedOptionIndex, setFocusedOptionIndex] = useState(0);

    const answersRef = useRef(null);
    const prevStepRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        if (prevStepRef.current !== step) {
            setFocusedOptionIndex(0);
            const firstOption = answersRef.current?.querySelector('button, input[type="radio"]');
            firstOption?.focus();
        }
        prevStepRef.current = step;
    }, [step, open]);

    const handleGroupKeyDown = useCallback((e) => {
        const options = Array.from(answersRef.current?.querySelectorAll('button[role="radio"], button[role="checkbox"], input[type="radio"]') ?? []);
        if (!options.length) return;
        const isVertical = ['ArrowDown', 'ArrowUp'].includes(e.key);
        const isHorizontal = ['ArrowRight', 'ArrowLeft'].includes(e.key);
        if (!isVertical && !isHorizontal) return;
        e.preventDefault();
        const delta = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
        const currentIndex = options.indexOf(document.activeElement);
        const baseIndex = currentIndex !== -1 ? currentIndex : 0;
        const next = (baseIndex + delta + options.length) % options.length;
        setFocusedOptionIndex(next);
        options[next].focus();
    }, []);

    useEffect(() => {
        if (!open) {
            prevStepRef.current = null;
        }
    }, [open]);

    const currentQ = localizedQuestions[step];
    const currentAnswer = answers[currentQ.key];
    const isAnswered = currentQ.multi
        ? Array.isArray(currentAnswer) && currentAnswer.length > 0
        : currentAnswer !== null;
    const isLastStep = step === QUESTIONS.length - 1;
    const progress = ((step) / QUESTIONS.length) * 100;

    const stepLabel = t('wizard.dialog.stepOf', { step: step + 1, total: QUESTIONS.length });

    return (
        <>
            {hasFilters ? (
                <FilterBanner role="region" aria-label={t('wizard.filterBanner.regionLabel')} aria-live="polite" aria-atomic="true">
                    <FilterBannerText>
                        <FilterBannerLabel>{t('wizard.filterBanner.label')}</FilterBannerLabel>
                        <FilterBannerChips>{buildChipLabel(profile, t)}</FilterBannerChips>
                    </FilterBannerText>
                    <FilterBannerActions>
                        <FilterBannerEditButton type="button" onClick={openWizard} aria-label={t('wizard.filterBanner.editAriaLabel')}>
                            {t('wizard.filterBanner.editButton')}
                        </FilterBannerEditButton>
                        <FilterBannerResetButton type="button" onClick={requestReset} aria-label={t('wizard.filterBanner.resetAriaLabel')}>
                            {t('wizard.filterBanner.resetButton')}
                        </FilterBannerResetButton>
                    </FilterBannerActions>
                </FilterBanner>
            ) : (
                <PersonalizeCard role="region" aria-label={t('wizard.personalizeCard.regionLabel')}>
                    <PersonalizeCardText>
                        <PersonalizeCardTitle>
                            <Tune aria-hidden />
                            <span>{t('wizard.personalizeCard.title')}</span>
                        </PersonalizeCardTitle>
                        <PersonalizeCardDesc>{t('wizard.personalizeCard.desc')}</PersonalizeCardDesc>
                    </PersonalizeCardText>
                    <PersonalizeCardButton type="button" onClick={openWizard} aria-label={t('wizard.personalizeCard.ariaLabel')}>
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ width: '1em', height: '1em', fill: 'currentColor', flexShrink: 0 }}>
                            <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
                        </svg>
                        {t('wizard.personalizeCard.button')}
                    </PersonalizeCardButton>
                </PersonalizeCard>
            )}

            <Dialog
                open={confirmResetOpen}
                onClose={cancelReset}
                maxWidth="xs"
                fullWidth
                aria-labelledby="confirm-reset-title"
                aria-describedby="confirm-reset-desc"
            >
                <DialogTitle id="confirm-reset-title" sx={{ fontWeight: 700, fontSize: '1.1rem', pb: 1 }}>
                    {t('wizard.confirmReset.title')}
                </DialogTitle>
                <DialogContent sx={{ pt: 0 }}>
                    <p id="confirm-reset-desc" style={{ margin: 0, fontSize: '0.95rem', color: theme.palette.text.secondary }}>
                        {t('wizard.confirmReset.body')}
                    </p>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                    <Button variant="outlined" onClick={cancelReset} color="inherit">
                        {t('wizard.confirmReset.cancel')}
                    </Button>
                    <Button variant="contained" onClick={handleReset} color="error">
                        {t('wizard.confirmReset.reset')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={open}
                onClose={closeWizard}
                maxWidth="sm"
                fullWidth
                aria-labelledby="wizard-title"
            >
                <div style={{ padding: '1.5rem 1.5rem 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span
                            aria-live="polite"
                            aria-atomic="true"
                            style={{ fontSize: '0.85rem', color: theme.palette.text.secondary, fontWeight: 600 }}
                        >
                            {stepLabel}
                        </span>
                        <button
                            type="button"
                            onClick={closeWizard}
                            aria-label={t('wizard.dialog.closeAriaLabel')}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '1.25rem',
                                color: theme.palette.text.secondary,
                                lineHeight: 1,
                                padding: '0.25rem',
                            }}
                        >
                            <span aria-hidden="true">✕</span>
                        </button>
                    </div>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        aria-label={stepLabel}
                        aria-valuenow={step + 1}
                        aria-valuemin={1}
                        aria-valuemax={QUESTIONS.length}
                        sx={{ borderRadius: 4, height: 6, mb: 2 }}
                    />
                    <h2
                        id="wizard-title"
                        style={{ fontSize: '1.2rem', fontWeight: 700, color: theme.palette.text.primary, margin: '0 0 0.25rem' }}
                    >
                        {currentQ.question}
                    </h2>
                    {currentQ.hint && (
                        <p style={{ fontSize: '0.875rem', color: theme.palette.text.secondary, margin: '0 0 1rem' }}>{currentQ.hint}</p>
                    )}
                </div>

                <DialogContent sx={{ pt: 1, pb: 0 }}>
                    <div ref={answersRef} role={currentQ.multi ? 'group' : 'radiogroup'} aria-labelledby="wizard-title" aria-required="true" onKeyDown={handleGroupKeyDown}>
                        {currentQ.options.map((opt, idx) => (
                            currentQ.radio
                                ? <RadioOption
                                    key={opt.value}
                                    option={opt}
                                    selected={currentAnswer}
                                    name={currentQ.key}
                                    onSelect={(val) => handleSingleSelectAndAdvance(currentQ.key, val)}
                                  />
                                : <OptionCard
                                    key={opt.value}
                                    option={opt}
                                    selected={currentAnswer}
                                    multi={currentQ.multi}
                                    tabIndex={idx === focusedOptionIndex ? 0 : -1}
                                    onSelect={(val) => {
                                        setFocusedOptionIndex(idx);
                                        if (currentQ.multi) {
                                            handleMultiSelect(currentQ.key, val, currentQ.noneValue);
                                        } else {
                                            handleSingleSelectAndAdvance(currentQ.key, val);
                                        }
                                    }}
                                  />
                        ))}
                    </div>
                </DialogContent>

                <div
                    style={{
                        padding: '1rem 1.5rem',
                        borderTop: `1px solid ${theme.palette.divider}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                    }}
                >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', order: 1 }}>
                        <Button
                            type="button"
                            variant="contained"
                            onClick={handleNext}
                            disabled={!isAnswered}
                            aria-disabled={!isAnswered}
                            color="primary"
                            sx={{ order: 2, fontWeight: 700 }}
                        >
                            {isLastStep ? t('wizard.dialog.finish') : t('wizard.dialog.next')}
                        </Button>
                        {step > 0 && (
                            <Button
                                type="button"
                                variant="outlined"
                                onClick={handleBack}
                                color="primary"
                                sx={{ order: 1, fontWeight: 600 }}
                            >
                                {t('wizard.dialog.back')}
                            </Button>
                        )}
                        <button
                            type="button"
                            onClick={handleSkip}
                            style={{
                                order: 0,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                color: theme.palette.text.secondary,
                                textDecoration: 'underline',
                                padding: '0.5rem 0',
                            }}
                        >
                            {t('wizard.dialog.skip')}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={requestReset}
                        style={{
                            order: 0,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            color: theme.palette.text.secondary,
                            textDecoration: 'underline',
                            padding: 0,
                        }}
                    >
                        {t('wizard.dialog.resetAll')}
                    </button>
                </div>
            </Dialog>
        </>
    );
};

export { loadProfile, QUESTIONS };
export default ApplicantWizard;
