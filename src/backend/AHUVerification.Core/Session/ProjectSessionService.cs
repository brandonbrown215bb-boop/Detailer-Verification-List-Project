using System;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;

namespace AHUVerification.Core.Session
{
    public class ProjectSessionService
    {
        private readonly object _lock = new();
        private ProjectSession? _activeSession;

        public ProjectSession? ActiveSession
        {
            get
            {
                lock (_lock)
                {
                    return _activeSession;
                }
            }
        }

        public ProjectSessionSnapshot OpenSource(OpenSourceCommand cmd, RulePackBundle activePack, int packGeneration)
        {
            if (cmd == null) throw new ArgumentNullException(nameof(cmd));
            if (string.IsNullOrWhiteSpace(cmd.ConfigXml))
                throw new ArgumentException("ConfigXml cannot be empty", nameof(cmd));

            lock (_lock)
            {
                var session = new ProjectSession(
                    cmd.FilePath,
                    cmd.ConfigXml,
                    cmd.OrderRevXml,
                    cmd.ManifestXml,
                    cmd.IsUpz,
                    cmd.IsTrusted,
                    activePack,
                    packGeneration,
                    cmd.InitialOverrides,
                    cmd.InitialChecklists,
                    cmd.InitialSpecialQuotes,
                    cmd.InitialGeneralComments
                );

                _activeSession = session;
                return session.CreateSnapshot();
            }
        }

        public ProjectSessionSnapshot? GetCurrentSnapshot()
        {
            lock (_lock)
            {
                return _activeSession?.CreateSnapshot();
            }
        }

        public SessionCommandResult OverrideFact(OverrideFactCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.OverrideFact(cmd));
        }

        public SessionCommandResult BatchOverrideFacts(BatchOverrideFactsCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.BatchOverrideFacts(cmd));
        }

        public SessionCommandResult RevertFact(RevertFactCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.RevertFact(cmd));
        }

        public SessionCommandResult UpdateChecklist(UpdateChecklistCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.UpdateChecklist(cmd));
        }

        public SessionCommandResult UpdateSpecialQuote(UpdateSpecialQuoteCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.UpdateSpecialQuote(cmd));
        }

        public SessionCommandResult DeleteSpecialQuote(DeleteSpecialQuoteCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.DeleteSpecialQuote(cmd));
        }

        public SessionCommandResult ReorderSpecialQuotes(ReorderSpecialQuotesCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.ReorderSpecialQuotes(cmd));
        }

        public SessionCommandResult UpdateGeneralComments(UpdateGeneralCommentsCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.UpdateGeneralComments(cmd));
        }

        public SessionCommandResult ResetSession(ResetSessionCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.ResetToBaseline(cmd));
        }

        private SessionCommandResult ExecuteSessionCommand(string sessionId, Func<ProjectSession, SessionCommandResult> action)
        {
            lock (_lock)
            {
                if (_activeSession == null)
                {
                    return SessionCommandResult.Fail("No active project session exists.");
                }

                if (!string.Equals(_activeSession.SessionId, sessionId, StringComparison.OrdinalIgnoreCase))
                {
                    return SessionCommandResult.Conflict(_activeSession.Revision, _activeSession.CreateSnapshot(),
                        $"Session mismatch: request was for session '{sessionId}', but active session is '{_activeSession.SessionId}'.");
                }

                return action(_activeSession);
            }
        }
    }
}
