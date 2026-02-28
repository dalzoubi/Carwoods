import React, { useState, useCallback, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
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

const QUESTIONS = [
    {
        key: 'employment',
        question: 'What is your employment status?',
        multi: false,
        options: [
            { value: 'employed', label: 'Employed', desc: 'Working for an employer (W-2)' },
            { value: 'self-employed', label: 'Self-Employed', desc: 'Own a business or work as a contractor' },
            { value: 'both', label: 'Both', desc: 'Employed and also self-employed' },
            { value: 'not-employed', label: 'Not currently employed', desc: 'Retired, student, or other' },
        ],
    },
    {
        key: 'hasPets',
        question: 'Do you have any pets or animals?',
        multi: false,
        options: [
            { value: 'none', label: 'No pets or animals', desc: '' },
            { value: 'pets', label: 'Yes — pet(s)', desc: 'Cats, dogs, or other household pets' },
            { value: 'service', label: 'Yes — service animal', desc: 'Trained to perform tasks related to a disability' },
            { value: 'esa', label: 'Yes — ESA or assistance animal', desc: 'Emotional support or other assistance animal' },
        ],
    },
    {
        key: 'benefits',
        question: 'Are you receiving any government or other benefits?',
        hint: 'Select all that apply',
        multi: true,
        noneValue: 'none',
        options: [
            { value: 'none', label: 'None', desc: '' },
            { value: 'va', label: 'VA Benefits', desc: 'Veterans Affairs benefits' },
            { value: 'ssa-ssi', label: 'Social Security (SSA / SSI)', desc: '' },
            { value: 'ssdi', label: 'SSDI', desc: 'Social Security Disability Insurance' },
            { value: 'retirement', label: 'Retirement / Pension', desc: '' },
            { value: 'child-support', label: 'Child Support or Spousal Maintenance', desc: '' },
            { value: 'other-benefits', label: 'Other benefits', desc: 'Any other government or agency benefits' },
        ],
    },
    {
        key: 'section8',
        question: 'Are you applying with housing assistance (Section 8 or similar)?',
        multi: false,
        options: [
            { value: 'no', label: 'No', desc: '' },
            { value: 'yes', label: 'Yes', desc: 'I have a Housing Choice Voucher or similar' },
        ],
    },
    {
        key: 'guarantorCosigner',
        question: 'Will you need a guarantor or co-signer?',
        multi: false,
        options: [
            { value: 'neither', label: 'Neither', desc: '' },
            { value: 'guarantor', label: 'Guarantor', desc: 'Signs a separate guaranty agreement' },
            { value: 'cosigner', label: 'Co-Signer', desc: 'Signs the lease as a co-tenant' },
            { value: 'not-sure', label: 'Not sure', desc: 'I may need one but am not certain' },
        ],
    },
    {
        key: 'creditScore',
        question: 'Do you know your approximate credit score?',
        multi: false,
        options: [
            { value: 'unknown', label: "I don't know", desc: '' },
            { value: '650-above', label: '650 or above', desc: 'Meets the minimum credit requirement' },
            { value: 'below-650', label: 'Below 650', desc: 'Below the standard minimum' },
        ],
    },
];

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

function buildChipLabel(profile) {
    const parts = [];

    const empMap = { employed: 'Employed', 'self-employed': 'Self-Employed', both: 'Employed + Self-Employed', 'not-employed': 'Not Employed' };
    if (profile.employment && empMap[profile.employment]) parts.push(empMap[profile.employment]);

    const petsMap = { pets: 'Pets', service: 'Service Animal', esa: 'ESA / Assistance Animal' };
    if (profile.hasPets && petsMap[profile.hasPets]) parts.push(petsMap[profile.hasPets]);

    const benefitMap = { va: 'VA Benefits', 'ssa-ssi': 'SSA/SSI', ssdi: 'SSDI', retirement: 'Retirement', 'child-support': 'Child Support', 'other-benefits': 'Other Benefits' };
    if (Array.isArray(profile.benefits)) {
        profile.benefits.filter(b => b !== 'none').forEach(b => { if (benefitMap[b]) parts.push(benefitMap[b]); });
    }

    if (profile.section8 === 'yes') parts.push('Section 8');

    const gcMap = { guarantor: 'Guarantor', cosigner: 'Co-Signer', 'not-sure': 'Guarantor/Co-Signer (unsure)' };
    if (profile.guarantorCosigner && gcMap[profile.guarantorCosigner]) parts.push(gcMap[profile.guarantorCosigner]);

    const creditMap = { 'below-650': 'Credit below 650', unknown: 'Credit unknown' };
    if (profile.creditScore && creditMap[profile.creditScore]) parts.push(creditMap[profile.creditScore]);

    return parts.length ? parts.join(' · ') : 'Custom filters active';
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

const RadioOption = ({ option, selected, name, onSelect }) => {
    const isSelected = selected === option.value;
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.6rem 0.75rem',
                marginBottom: '0.375rem',
                borderRadius: '8px',
                cursor: 'pointer',
                background: isSelected ? '#e8f0fe' : 'transparent',
                border: isSelected ? '1.5px solid #1976d2' : '1.5px solid transparent',
                transition: 'background 0.15s, border-color 0.15s',
            }}
        >
            <input
                type="radio"
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onSelect(option.value)}
                style={{ marginTop: '3px', accentColor: '#1976d2', flexShrink: 0 }}
            />
            <span>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem', color: '#1a1a2e' }}>{option.label}</span>
                {option.desc && <span style={{ display: 'block', fontSize: '0.875rem', color: '#555', marginTop: '2px' }}>{option.desc}</span>}
            </span>
        </label>
    );
};

const OptionCard = ({ option, selected, multi, onSelect }) => {
    const isSelected = multi
        ? Array.isArray(selected) && selected.includes(option.value)
        : selected === option.value;

    return (
        <button
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={isSelected}
            onClick={() => onSelect(option.value)}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                width: '100%',
                textAlign: 'left',
                padding: '0.75rem 1rem',
                marginBottom: '0.5rem',
                background: isSelected ? '#e8f0fe' : '#fff',
                border: isSelected ? '2px solid #1976d2' : '1.5px solid #d0d7e3',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                fontFamily: 'inherit',
            }}
        >
            <span
                style={{
                    flexShrink: 0,
                    marginTop: '2px',
                    width: '18px',
                    height: '18px',
                    borderRadius: multi ? '4px' : '50%',
                    border: isSelected ? '2px solid #1976d2' : '2px solid #9aa5b4',
                    background: isSelected ? '#1976d2' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                aria-hidden="true"
            >
                {isSelected && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        {multi
                            ? <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            : <circle cx="6" cy="6" r="3" fill="#fff" />
                        }
                    </svg>
                )}
            </span>
            <span>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem', color: '#1a1a2e' }}>{option.label}</span>
                {option.desc && <span style={{ display: 'block', fontSize: '0.875rem', color: '#555', marginTop: '2px' }}>{option.desc}</span>}
            </span>
        </button>
    );
};

const ApplicantWizard = ({ onProfileChange }) => {
    const [profile, setProfile] = useState(() => loadProfile());
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState(() => getInitialAnswers(loadProfile()));

    const hasFilters = profile !== null;

    const openWizard = useCallback(() => {
        setAnswers(getInitialAnswers(loadProfile()));
        setStep(0);
        setOpen(true);
    }, []);

    const closeWizard = useCallback(() => setOpen(false), []);

    const handleReset = useCallback(() => {
        clearProfile();
        setProfile(null);
        setAnswers(getInitialAnswers(null));
        setOpen(false);
        if (onProfileChange) onProfileChange(null);
    }, [onProfileChange]);

    const handleSelect = useCallback((key, value, multi, noneValue) => {
        setAnswers(prev => {
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
        });
    }, []);

    const handleNext = useCallback(() => {
        if (step < QUESTIONS.length - 1) {
            setStep(s => s + 1);
        } else {
            const newProfile = {};
            QUESTIONS.forEach(q => {
                const val = answers[q.key];
                const isEmpty = q.multi ? (!Array.isArray(val) || val.length === 0) : val === null;
                if (!isEmpty) newProfile[q.key] = val;
            });
            saveProfile(newProfile);
            setProfile(newProfile);
            setOpen(false);
            if (onProfileChange) onProfileChange(newProfile);
        }
    }, [step, answers, onProfileChange]);

    const handleBack = useCallback(() => setStep(s => s - 1), []);

    const handleSkip = useCallback(() => {
        const q = QUESTIONS[step];
        setAnswers(prev => ({ ...prev, [q.key]: q.multi ? [] : null }));
        if (step < QUESTIONS.length - 1) {
            setStep(s => s + 1);
        } else {
            handleNext();
        }
    }, [step, handleNext]);

    useEffect(() => {
        if (onProfileChange) onProfileChange(profile);
    }, []);  // eslint-disable-line react-hooks/exhaustive-deps

    const currentQ = QUESTIONS[step];
    const currentAnswer = answers[currentQ.key];
    const isAnswered = currentQ.multi
        ? Array.isArray(currentAnswer) && currentAnswer.length > 0
        : currentAnswer !== null;
    const isLastStep = step === QUESTIONS.length - 1;
    const progress = ((step) / QUESTIONS.length) * 100;

    return (
        <>
            {hasFilters ? (
                <FilterBanner role="region" aria-label="Active filters" aria-live="polite" aria-atomic="true">
                    <FilterBannerText>
                        <FilterBannerLabel>Filtered view</FilterBannerLabel>
                        <FilterBannerChips>{buildChipLabel(profile)}</FilterBannerChips>
                    </FilterBannerText>
                    <FilterBannerActions>
                        <FilterBannerEditButton type="button" onClick={openWizard} aria-label="Edit filters">
                            Edit filters
                        </FilterBannerEditButton>
                        <FilterBannerResetButton type="button" onClick={handleReset} aria-label="Reset filters and show all sections">
                            Reset — show all
                        </FilterBannerResetButton>
                    </FilterBannerActions>
                </FilterBanner>
            ) : (
                <PersonalizeCard role="region" aria-label="Personalize this page">
                    <PersonalizeCardText>
                        <PersonalizeCardTitle>Filter for your situation</PersonalizeCardTitle>
                        <PersonalizeCardDesc>6 quick questions — see only what applies to you.</PersonalizeCardDesc>
                    </PersonalizeCardText>
                    <PersonalizeCardButton type="button" onClick={openWizard} aria-label="Personalize this page">
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ width: '1em', height: '1em', fill: 'currentColor', flexShrink: 0 }}>
                            <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
                        </svg>
                        Personalize
                    </PersonalizeCardButton>
                </PersonalizeCard>
            )}

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
                            style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}
                        >
                            Step {step + 1} of {QUESTIONS.length}
                        </span>
                        <button
                            type="button"
                            onClick={closeWizard}
                            aria-label="Close wizard"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#666', lineHeight: 1, padding: '0.25rem' }}
                        >
                            ✕
                        </button>
                    </div>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        aria-label={`Step ${step + 1} of ${QUESTIONS.length}`}
                        aria-valuenow={step + 1}
                        aria-valuemin={1}
                        aria-valuemax={QUESTIONS.length}
                        sx={{ borderRadius: 4, height: 6, mb: 2, backgroundColor: '#e0e7ff', '& .MuiLinearProgress-bar': { backgroundColor: '#1976d2' } }}
                    />
                    <h2
                        id="wizard-title"
                        style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.25rem' }}
                    >
                        {currentQ.question}
                    </h2>
                    {currentQ.hint && (
                        <p style={{ fontSize: '0.875rem', color: '#666', margin: '0 0 1rem' }}>{currentQ.hint}</p>
                    )}
                </div>

                <DialogContent sx={{ pt: 1, pb: 0 }}>
                    <div role={currentQ.multi ? 'group' : 'radiogroup'} aria-labelledby="wizard-title" aria-required="true">
                        {currentQ.options.map(opt => (
                            currentQ.radio
                                ? <RadioOption
                                    key={opt.value}
                                    option={opt}
                                    selected={currentAnswer}
                                    name={currentQ.key}
                                    onSelect={(val) => handleSelect(currentQ.key, val, false, undefined)}
                                  />
                                : <OptionCard
                                    key={opt.value}
                                    option={opt}
                                    selected={currentAnswer}
                                    multi={currentQ.multi}
                                    onSelect={(val) => handleSelect(currentQ.key, val, currentQ.multi, currentQ.noneValue)}
                                  />
                        ))}
                    </div>
                </DialogContent>

                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={handleReset}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#999', textDecoration: 'underline', padding: 0 }}
                    >
                        Reset all &amp; close
                    </button>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={handleSkip}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#666', textDecoration: 'underline', padding: '0.5rem 0' }}
                        >
                            Skip
                        </button>
                        {step > 0 && (
                            <button
                                type="button"
                                onClick={handleBack}
                                style={{ padding: '0.5rem 1.25rem', background: '#fff', border: '1.5px solid #1976d2', borderRadius: '8px', color: '#1976d2', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
                            >
                                Back
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={isAnswered ? handleNext : undefined}
                            aria-disabled={!isAnswered}
                            style={{
                                padding: '0.5rem 1.5rem',
                                background: isAnswered ? '#1976d2' : '#c5d5ea',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                cursor: isAnswered ? 'pointer' : 'not-allowed',
                                transition: 'background 0.2s',
                            }}
                        >
                            {isLastStep ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>
            </Dialog>
        </>
    );
};

export { loadProfile, QUESTIONS };
export default ApplicantWizard;
